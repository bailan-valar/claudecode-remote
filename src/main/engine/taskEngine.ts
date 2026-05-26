import { EventEmitter } from 'node:events'
import PQueueModule from 'p-queue'
const PQueue = (PQueueModule as any).default || PQueueModule
import type PouchDB from 'pouchdb'
import type { LogEntry } from './runner'
import { getRunner } from './runnerRegistry'
import { autoCommit } from './gitAutoCommit'
import { createTaskRepository } from '../repositories/taskRepository'
import { createProjectRepository } from '../repositories/projectRepository'
import { sendWecomMessage, buildTaskCompletedMarkdown, buildTaskFailedMarkdown, buildMentionTextMessage } from './wecomNotifier'
import { computeTimeTrackingChanges } from '../utils/taskTimeTracking'
import type { Task } from '../../shared/types'
import { TASK_STATUS, type TaskStatus } from '../../shared/constants'

const DEFAULT_BASE_URL = process.env.APP_BASE_URL || 'https://remote-dev.capdien.site/#/'

function buildTaskUrl(project: { siteUrl?: string }, taskId: string): string | undefined {
  const base = project.siteUrl?.trim() || DEFAULT_BASE_URL
  if (!base) return undefined
  const cleanBase = base.replace(/\/+$/, '')
  // 兼容已包含 /# 路由前缀的地址
  if (cleanBase.includes('/#')) {
    return `${cleanBase}/tasks/${taskId}`
  }
  return `${cleanBase}/#/tasks/${taskId}`
}

async function getProjectPendingCount(
  taskRepo: ReturnType<typeof createTaskRepository>,
  projectId: string,
): Promise<number> {
  const allTasks = await taskRepo.findAll()
  return allTasks.filter(
    (t) => t.projectId === projectId && (t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.PLAN_REQUIRED),
  ).length
}

export interface EngineStatus {
  running: boolean
  runningCount: number
  queueSize: number
  currentTaskIds: string[]
  concurrency: number
  provider: string
}

export interface EngineOptions {
  db: PouchDB.Database
  concurrency?: number
  provider?: string
}

/**
 * 检查任务是否满足开发完成条件（待审核、已完成等状态）
 */
function isTaskCompleted(status: TaskStatus): boolean {
  return status === TASK_STATUS.REVIEWING ||
         status === TASK_STATUS.PLAN_REVIEWING ||
         status === TASK_STATUS.COMPLETED ||
         status === TASK_STATUS.CLOSED
}

/**
 * 检查任务的前置任务是否都已完成
 */
async function checkPrerequisitesCompleted(
  task: Task,
  taskRepo: ReturnType<typeof createTaskRepository>
): Promise<{ completed: boolean; blockingTasks?: Task[] }> {
  if (!task.prerequisiteTaskIds || task.prerequisiteTaskIds.length === 0) {
    return { completed: true }
  }

  const blockingTasks: Task[] = []
  for (const prereqId of task.prerequisiteTaskIds) {
    const prereqTask = await taskRepo.findById(prereqId)
    if (!prereqTask) {
      console.warn(`[engine] prerequisite task ${prereqId} not found for task ${task._id}`)
      continue
    }
    if (!isTaskCompleted(prereqTask.status)) {
      blockingTasks.push(prereqTask)
    }
  }

  return { completed: blockingTasks.length === 0, blockingTasks }
}

/**
 * 任务引擎：自动消费 pending 任务，按项目配置调用对应执行引擎。
 * 支持项目级串行 + 全局并发控制，执行引擎可插拔切换。
 */
export class TaskEngine extends EventEmitter {
  private db: PouchDB.Database
  private queue: InstanceType<typeof PQueue>
  private runningTasks = new Map<string, AbortController>()
  private changesFeed?: PouchDB.Core.Changes<{}>
  private _running = false
  private _concurrency: number
  private _provider?: string
  private projectLocks = new Map<string, Promise<void>>()
  private stoppedTaskIds = new Set<string>()
  private queuedTaskIds = new Set<string>()
  private taskEnqueueLocks = new Map<string, Promise<void>>() // 任务级入队锁，防止并发入队同一个任务
  private projectInQueue = new Set<string>() // 标记已有任务在 p-queue 中的项目
  private deferredTasks = new Map<string, Task[]>() // 项目级延迟队列（不占用全局并发槽位）

  constructor(options: EngineOptions) {
    super()
    this.db = options.db
    this._concurrency = options.concurrency ?? 1
    this._provider = options.provider
    this.queue = new PQueue({ concurrency: this._concurrency })

    this.queue.on('active', () => this.emit('status', this.getStatus()))
    this.queue.on('completed', () => this.emit('status', this.getStatus()))
    this.queue.on('error', (err: any) => {
      console.error('[engine] queue error:', err)
      this.emit('status', this.getStatus())
    })
  }

  get running(): boolean {
    return this._running
  }

  get concurrency(): number {
    return this._concurrency
  }

  setConcurrency(n: number): void {
    if (n < 1) n = 1
    this._concurrency = n
    this.queue.concurrency = n
    this.emit('status', this.getStatus())
  }

  getProvider(): string {
    // 当前仅支持 Claude Code 执行引擎
    return 'anthropic'
  }

  setProvider(_name: string): void {
    // 当前仅支持 Claude Code，忽略其他 provider 设置
    this._provider = 'anthropic'
    this.emit('status', this.getStatus())
  }

  getStatus(): EngineStatus {
    return {
      running: this._running,
      runningCount: this.runningTasks.size,
      queueSize: this.queue.size + this.queue.pending,
      currentTaskIds: Array.from(this.runningTasks.keys()),
      concurrency: this._concurrency,
      provider: this.getProvider(),
    }
  }

  start(): void {
    if (this._running) return
    this._running = true
    console.log('[engine] started')

    // 先回收长时间未更新的孤儿任务，再扫描 pending，避免遗漏
    this._recoverStaleTasks().then(() => {
      this._scanPending()
    })

    this.changesFeed = this.db
      .changes({ live: true, since: 'now', include_docs: true })
      .on('change', async (change) => {
        const doc = change.doc as any
        if (!doc || doc.type !== 'task') return

        const task = doc as Task

        // 更严格的状态检查，避免重复入队
        const shouldEnqueue = (task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.PLAN_REQUIRED) &&
                             !this.runningTasks.has(task._id) &&
                             !this.queuedTaskIds.has(task._id) &&
                             !this.taskEnqueueLocks.has(task._id)

        if (shouldEnqueue) {
          this._enqueue(task)
        }

        // 如果任务状态变为完成状态，检查是否有依赖它的任务需要入队
        if (isTaskCompleted(task.status)) {
          const taskRepo = createTaskRepository(this.db)
          try {
            const allTasks = await taskRepo.findAll()
            const dependentTasks = allTasks.filter(t =>
              t.prerequisiteTaskIds?.includes(task._id) &&
              (t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.PLAN_REQUIRED) &&
              !this.runningTasks.has(t._id) &&
              !this.queuedTaskIds.has(t._id)
            )

            for (const dependentTask of dependentTasks) {
              console.log(`[engine] prerequisite task ${task._id} completed, checking dependent task ${dependentTask._id}`)
              this._enqueue(dependentTask)
            }
          } catch (err) {
            console.error('[engine] error processing dependent tasks:', err)
          }
        }
      })
      .on('error', (err) => {
        console.error('[engine] changes feed error:', err)
      })

    this.emit('status', this.getStatus())
  }

  stop(): void {
    if (!this._running) return
    this._running = false
    console.log('[engine] stopped')

    this.changesFeed?.cancel?.()
    this.changesFeed = undefined

    // 清空队列中等待的任务
    this.queue.clear()
    this.queuedTaskIds.clear()
    this.projectInQueue.clear()
    this.deferredTasks.clear()

    // 标记并中止正在运行的任务
    for (const [taskId, ctrl] of this.runningTasks) {
      this.stoppedTaskIds.add(taskId)
      ctrl.abort()
    }

    this.emit('status', this.getStatus())
  }

  pause(): void {
    this.queue.pause()
    this.emit('status', this.getStatus())
  }

  resume(): void {
    this.queue.start()
    this.emit('status', this.getStatus())
  }

  /**
   * 继续执行被停止的任务
   */
  async resumeTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
    if (!this._running) {
      return { ok: false, error: '引擎未运行，请先启动引擎' }
    }

    const taskRepo = createTaskRepository(this.db)
    let task = await taskRepo.findById(taskId)
    if (!task) {
      return { ok: false, error: '任务不存在' }
    }

    const canResume = task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.PLAN_REQUIRED || task.status === TASK_STATUS.STOPPED || task.status === TASK_STATUS.FAILED
    if (!canResume) {
      return { ok: false, error: `任务状态为 ${task.status}，无法继续执行` }
    }

    // 如果是 stopped 状态，先恢复为可执行状态
    if (task.status === TASK_STATUS.STOPPED) {
      const resumeStatus = task.isPlan ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING
      await taskRepo.update(taskId, {
        status: resumeStatus,
        reviewFeedback: undefined,
        updatedAt: new Date().toISOString(),
      })
      task = { ...task, status: resumeStatus }
    }

    // 从停止列表中移除
    this.stoppedTaskIds.delete(taskId)

    // 清理可能存在的锁状态，确保任务可以被重新入队
    this.queuedTaskIds.delete(taskId)
    const existingLock = this.taskEnqueueLocks.get(taskId)
    if (existingLock) {
      await existingLock
      this.taskEnqueueLocks.delete(taskId)
    }

    // 重新加入队列
    await this._enqueue(task)

    return { ok: true }
  }

  /**
   * 停止正在运行的任务
   */
  async stopTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
    const controller = this.runningTasks.get(taskId)
    if (!controller) {
      return { ok: false, error: '任务未在运行中' }
    }

    // 标记任务为已停止
    this.stoppedTaskIds.add(taskId)

    // 中止任务执行
    controller.abort()

    console.log(`[engine] stopping task ${taskId}`)

    return { ok: true }
  }

  /**
   * 手动添加日志到任务
   */
  async addTaskLog(taskId: string, message: string): Promise<{ ok: boolean; error?: string }> {
    const taskRepo = createTaskRepository(this.db)
    const task = await taskRepo.findById(taskId)
    if (!task) {
      return { ok: false, error: '任务不存在' }
    }

    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
    }

    const logs = [...(task.logs || []), newLog]

    try {
      await taskRepo.update(taskId, { logs })
      // 发射日志更新事件，通知前端
      this.emit('task:logs_updated', taskId, logs)
      console.log(`[engine] added manual log to task ${taskId}`)
      return { ok: true }
    } catch (err: any) {
      console.error(`[engine] failed to add log to task ${taskId}:`, err)
      return { ok: false, error: err.message || '添加日志失败' }
    }
  }

  private async _scanPending(): Promise<void> {
    const taskRepo = createTaskRepository(this.db)
    const tasks = await taskRepo.findAll()
    const pending = tasks.filter((t) => {
      // 过滤掉已经在处理中的任务，避免重复入队
      return (t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.PLAN_REQUIRED) &&
             !this.runningTasks.has(t._id) &&
             !this.queuedTaskIds.has(t._id) &&
             !this.taskEnqueueLocks.has(t._id)
    })

    console.log(`[engine] scanning pending tasks: found ${pending.length} tasks to enqueue`)
    for (const task of pending) {
      this._enqueue(task)
    }
  }

  /**
   * 回收长时间未更新的孤儿任务。
   * 应用在执行中崩溃/退出时，任务可能永远停留在 developing/planning。
   * 将其重置为 pending 并追加 "继续" 提示，利用 --resume 恢复上下文。
   */
  private async _recoverStaleTasks(): Promise<void> {
    const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 分钟
    const taskRepo = createTaskRepository(this.db)
    const tasks = await taskRepo.findAll()
    const now = Date.now()

    for (const task of tasks) {
      if (task.status !== TASK_STATUS.DEVELOPING && task.status !== TASK_STATUS.PLANNING) {
        continue
      }

      const lastUpdate = new Date(task.updatedAt).getTime()
      if (now - lastUpdate < STALE_THRESHOLD_MS) {
        continue
      }

      // 防御性检查：避免与当前真正在运行的任务冲突
      if (this.runningTasks.has(task._id)) {
        continue
      }

      console.log(`[engine] recovering stale task ${task._id}, last update: ${task.updatedAt}, status: ${task.status}`)

      try {
        await taskRepo.update(task._id, {
          status: TASK_STATUS.PENDING,
          updatedAt: new Date().toISOString(),
        })
        console.log(`[engine] stale task ${task._id} recovered to pending`)
      } catch (err: any) {
        console.error(`[engine] failed to recover stale task ${task._id}:`, err.message)
      }
    }
  }

  private async _enqueue(task: Task): Promise<void> {
    if (!this._running) return

    // 检查前置任务是否完成
    const taskRepo = createTaskRepository(this.db)
    const prereqCheck = await checkPrerequisitesCompleted(task, taskRepo)
    if (!prereqCheck.completed) {
      const blockingTitles = prereqCheck.blockingTasks?.map(t => t.title).join(', ') || 'unknown'
      console.log(`[engine] task ${task._id} waiting for prerequisites: ${blockingTitles}`)
      return
    }

    // 获取任务级入队锁，防止同一个任务被并发入队
    const existingLock = this.taskEnqueueLocks.get(task._id)
    if (existingLock) {
      console.log(`[engine] task ${task._id} is already being enqueued, waiting...`)
      await existingLock // 等待现有的入队操作完成
    }

    // 双重检查：在获取锁后再次检查任务状态
    if (this.runningTasks.has(task._id)) {
      console.log(`[engine] task ${task._id} is already running, skipping enqueue`)
      return
    }
    if (this.queuedTaskIds.has(task._id)) {
      console.log(`[engine] task ${task._id} is already queued, skipping duplicate enqueue`)
      return
    }

    let resolveLock!: () => void
    const currentLock = new Promise<void>((resolve) => {
      resolveLock = resolve
    })
    this.taskEnqueueLocks.set(task._id, currentLock)

    try {
      // 第三次检查：在设置锁后再次确认
      if (this.runningTasks.has(task._id)) {
        console.log(`[engine] task ${task._id} started running while waiting for lock, skipping`)
        return
      }
      if (this.queuedTaskIds.has(task._id)) {
        console.log(`[engine] task ${task._id} was queued while waiting for lock, skipping`)
        return
      }

      // 再次检查前置任务（可能在等待锁的过程中前置任务完成了）
      const latestPrereqCheck = await checkPrerequisitesCompleted(task, taskRepo)
      if (!latestPrereqCheck.completed) {
        const blockingTitles = latestPrereqCheck.blockingTasks?.map(t => t.title).join(', ') || 'unknown'
        console.log(`[engine] task ${task._id} prerequisites still not complete: ${blockingTitles}`)
        return
      }

      // 项目级串行：如果该项目已有任务在 p-queue 中，延迟入队（不占用全局并发槽位）
      if (this.projectInQueue.has(task.projectId)) {
        const deferred = this.deferredTasks.get(task.projectId) ?? []
        deferred.push(task)
        this.deferredTasks.set(task.projectId, deferred)
        console.log(`[engine] task ${task._id} deferred for project ${task.projectId} (project already in queue, deferred: ${deferred.length})`)
        return
      }

      this.projectInQueue.add(task.projectId)
      this.queuedTaskIds.add(task._id)
      console.log(`[engine] enqueuing task ${task._id} (status: ${task.status}, queue size: ${this.queue.size})`)

      this.queue.add(async () => {
        try {
          await this._executeWithProjectLock(task)
        } finally {
          this.queuedTaskIds.delete(task._id)
          this.projectInQueue.delete(task.projectId)
          console.log(`[engine] task ${task._id} removed from queue`)

          // 调度该项目的下一个延迟任务
          const deferred = this.deferredTasks.get(task.projectId)
          if (deferred && deferred.length > 0) {
            const nextTask = deferred.shift()!
            if (deferred.length === 0) {
              this.deferredTasks.delete(task.projectId)
            }
            console.log(`[engine] scheduling deferred task ${nextTask._id} for project ${task.projectId}`)
            setImmediate(() => this._enqueue(nextTask))
          }
        }
      })

      this.emit('status', this.getStatus())
    } finally {
      resolveLock()
      // 清理锁，避免内存泄漏
      setTimeout(() => {
        if (this.taskEnqueueLocks.get(task._id) === currentLock) {
          this.taskEnqueueLocks.delete(task._id)
        }
      }, 1000)
    }
  }

  private async _executeWithProjectLock(task: Task): Promise<void> {
    // 等待同项目的上一个任务完成（项目级串行）
    const prevLock = this.projectLocks.get(task.projectId)
    if (prevLock) {
      await prevLock
    }

    // 在获取项目锁后，再次检查任务状态
    if (!this._running) {
      console.log(`[engine] engine stopped before executing task ${task._id}`)
      return
    }

    if (this.stoppedTaskIds.has(task._id)) {
      console.log(`[engine] task ${task._id} was marked as stopped`)
      return
    }

    let resolveLock!: () => void
    const currentLock = new Promise<void>((resolve) => {
      resolveLock = resolve
    })
    this.projectLocks.set(task.projectId, currentLock)

    try {
      await this._execute(task)
    } finally {
      resolveLock()
      if (this.projectLocks.get(task.projectId) === currentLock) {
        this.projectLocks.delete(task.projectId)
      }
    }
  }

  private async _execute(task: Task): Promise<void> {
    if (!this._running) {
      console.log(`[engine] engine stopped, skipping task ${task._id}`)
      return
    }

    const taskRepo = createTaskRepository(this.db)
    const projectRepo = createProjectRepository(this.db)

    const latestTask = await taskRepo.findById(task._id) ?? task

    // 检查任务当前状态是否仍然可执行
    const canExecute = latestTask.status === TASK_STATUS.PENDING ||
                      latestTask.status === TASK_STATUS.PLAN_REQUIRED ||
                      (latestTask.status === TASK_STATUS.STOPPED && !this.stoppedTaskIds.has(task._id))

    if (!canExecute) {
      console.log(`[engine] task ${task._id} status changed to ${latestTask.status}, skipping execution`)
      return
    }

    const isPlanTask = latestTask.isPlan === true

    const project = await projectRepo.findById(task.projectId)
    if (!project) {
      console.error('[engine] project not found:', task.projectId)
      const errorStatus = TASK_STATUS.FAILED
      const timeChanges = computeTimeTrackingChanges(latestTask, errorStatus)
      await taskRepo.update(task._id, {
        status: errorStatus,
        reviewFeedback: '项目不存在',
        updatedAt: new Date().toISOString(),
        ...timeChanges,
      })
      return
    }

    // 子任务 session 继承
    let inheritedSessionId = task.claudeSessionId
    if (!inheritedSessionId && task.parentTaskId) {
      const parent = await taskRepo.findById(task.parentTaskId)
      if (parent?.claudeSessionId) {
        inheritedSessionId = parent.claudeSessionId
      }
    }

    const startStatus = isPlanTask ? TASK_STATUS.PLANNING : TASK_STATUS.DEVELOPING
    const startTimeChanges = computeTimeTrackingChanges(latestTask, startStatus)

    try {
      // 使用乐观锁机制更新任务状态，防止并发执行
      await taskRepo.update(task._id, {
        status: startStatus,
        claudeSessionId: inheritedSessionId,
        reviewFeedback: undefined,
        updatedAt: new Date().toISOString(),
        ...startTimeChanges,
      })
    } catch (error: any) {
      // 如果更新失败（可能是冲突），重新检查任务状态
      const currentTask = await taskRepo.findById(task._id)
      if (currentTask && currentTask.status !== startStatus) {
        console.log(`[engine] task ${task._id} status conflict, current: ${currentTask.status}, skipping execution`)
        return
      }
      throw error
    }

    this.emit('task:started', task._id)

    const controller = new AbortController()
    this.runningTasks.set(task._id, controller)
    this.emit('status', this.getStatus())

    const logs: LogEntry[] = [...(task.logs ?? [])]

    const taskWithSession: Task = {
      ...task,
      claudeSessionId: inheritedSessionId,
      title: latestTask.title,
      description: latestTask.description,
    }

    try {
      const runner = getRunner(this._provider ?? 'anthropic')
      console.log(`[engine] 使用执行引擎: ${runner.name} (provider=${this._provider ?? 'anthropic'})`)
      const result = await runner.runTask(taskWithSession, project, {
        onLog: (entry) => {
          logs.push(entry)
          this._throttledLogWrite(task._id, logs)
        },
        abortSignal: controller.signal,
      })

      // 取消 pending 的日志定时器，避免与状态更新产生并发冲突
      const existingTimer = this._logWriteTimers.get(task._id)
      if (existingTimer) {
        clearTimeout(existingTimer)
        this._logWriteTimers.delete(task._id)
      }
      this._pendingLogs.delete(task._id)

      if (result.success) {
        const currentTask = await taskRepo.findById(task._id) ?? latestTask
        const endStatus = isPlanTask ? TASK_STATUS.PLAN_REVIEWING : TASK_STATUS.REVIEWING
        const endTimeChanges = computeTimeTrackingChanges(currentTask, endStatus)

        // 将结果保存到当前历史阶段（reviewing / plan_reviewing）
        if (endTimeChanges.statusHistory && result.result) {
          const history = endTimeChanges.statusHistory as any[]
          const currentEntry = history[history.length - 1]
          if (currentEntry) {
            currentEntry.result = result.result
          }
        }

        const updateData: any = {
          status: endStatus,
          claudeSessionId: result.sessionId ?? inheritedSessionId,
          logs,
          updatedAt: new Date().toISOString(),
          ...endTimeChanges,
        }

        if (isPlanTask) {
          updateData.planOutput = result.result ?? ''
        } else {
          const durationSeconds = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
          const commitResult = await autoCommit(project.path, task.title, durationSeconds, currentTask.kind)
          const commitLog: LogEntry = {
            timestamp: new Date().toISOString(),
            level: commitResult.success ? 'info' : 'warn',
            message: commitResult.success
              ? `[Git] ${commitResult.message}`
              : `[Git] ${commitResult.error}`,
          }
          logs.push(commitLog)
          updateData.completedAt = new Date().toISOString()
          updateData.result = result.result ?? ''
        }

        await taskRepo.update(task._id, updateData)

        // 企业微信通知（非阻塞）
        if (project.webhookEnabled && project.webhookUrl) {
          const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
          const pendingCount = await getProjectPendingCount(taskRepo, task.projectId)
          const statusLabel = isPlanTask ? '计划待审核' : '待审核'
          const msg = buildTaskCompletedMarkdown({
            projectName: project.name,
            taskTitle: task.title,
            taskId: task._id,
            status: statusLabel,
            taskDescription: task.description,
            logsCount: logs.length,
            commitMessage: undefined,
            durationMs: totalSec * 1000,
            taskUrl: buildTaskUrl(project, task._id),
            pendingCount,
          })
          void sendWecomMessage(project.webhookUrl, msg).then((res) => {
            if (!res.success) {
              console.error('[wecom] 通知发送失败:', res.error)
            } else {
              console.log('[wecom] 通知已发送')
            }
          })
          // @提及（独立的 text 消息）
          const mentioned = project.webhookMentionedList?.filter(Boolean) ?? []
          if (mentioned.length > 0) {
            const mentionMsg = buildMentionTextMessage(
              mentioned,
              isPlanTask ? `任务「${task.title}」计划已编写完成，待审核` : `任务「${task.title}」已开发完成，待审核`,
            )
            void sendWecomMessage(project.webhookUrl, mentionMsg)
          }
        }

        this.emit('task:completed', task._id, result)
      } else {
        const currentTask = await taskRepo.findById(task._id) ?? latestTask
        const isStopped = this.stoppedTaskIds.has(task._id)

        if (isStopped) {
          const endTimeChanges = computeTimeTrackingChanges(currentTask, TASK_STATUS.STOPPED)
          if (endTimeChanges.statusHistory && result.error) {
            const history = endTimeChanges.statusHistory as any[]
            const closedEntry = history[history.length - 2]
            if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
              closedEntry.result = `任务已停止: ${result.error}`
            }
          }
          await taskRepo.update(task._id, {
            status: TASK_STATUS.STOPPED,
            reviewFeedback: '任务已停止',
            claudeSessionId: result.sessionId ?? inheritedSessionId,
            logs,
            updatedAt: new Date().toISOString(),
            ...endTimeChanges,
          })
          this.emit('task:stopped', task._id)
        } else {
          const errorStatus = isPlanTask ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING
          const endTimeChanges = computeTimeTrackingChanges(currentTask, errorStatus)
          if (endTimeChanges.statusHistory && result.error) {
            const history = endTimeChanges.statusHistory as any[]
            const closedEntry = history[history.length - 2]
            if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
              closedEntry.result = `执行失败: ${result.error}`
            }
          }

          await taskRepo.update(task._id, {
            status: errorStatus,
            reviewFeedback: result.error ?? '执行失败',
            claudeSessionId: result.sessionId ?? inheritedSessionId,
            logs,
            updatedAt: new Date().toISOString(),
            ...endTimeChanges,
          })

          // 失败通知（默认开启，可通过 webhookNotifyOnFailure=false 关闭）
          if (
            project.webhookEnabled &&
            project.webhookUrl &&
            project.webhookNotifyOnFailure !== false
          ) {
            const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
            const pendingCount = await getProjectPendingCount(taskRepo, task.projectId)
            const failMsg = buildTaskFailedMarkdown({
              projectName: project.name,
              taskTitle: task.title,
              taskId: task._id,
              taskDescription: task.description,
              error: result.error ?? '执行失败',
              durationMs: totalSec * 1000,
              taskUrl: buildTaskUrl(project, task._id),
              pendingCount,
            })
            void sendWecomMessage(project.webhookUrl, failMsg).then((res) => {
              if (!res.success) {
                console.error('[wecom] 失败通知发送失败:', res.error)
              }
            })
          }

          this.emit('task:failed', task._id, result.error)
        }
      }
    } catch (err: any) {
      const currentTask = await taskRepo.findById(task._id) ?? latestTask
      const wasStopped = this.stoppedTaskIds.has(task._id)
      const errorStatus = wasStopped ? TASK_STATUS.STOPPED : (isPlanTask ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING)
      const endTimeChanges = computeTimeTrackingChanges(currentTask, errorStatus)
      if (endTimeChanges.statusHistory && err.message) {
        const history = endTimeChanges.statusHistory as any[]
        const closedEntry = history[history.length - 2]
        if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
          closedEntry.result = wasStopped ? `任务已停止: ${err.message}` : `执行异常: ${err.message}`
        }
      }
      await taskRepo.update(task._id, {
        status: errorStatus,
        reviewFeedback: wasStopped ? '任务已停止' : `异常: ${err.message}`,
        logs,
        updatedAt: new Date().toISOString(),
        ...endTimeChanges,
      })

      // 异常情况下的失败通知
      if (
        project.webhookEnabled &&
        project.webhookUrl &&
        project.webhookNotifyOnFailure !== false
      ) {
        const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
        const pendingCount = await getProjectPendingCount(taskRepo, task.projectId)
        const failMsg = buildTaskFailedMarkdown({
          projectName: project.name,
          taskTitle: task.title,
          taskId: task._id,
          taskDescription: task.description,
          error: wasStopped ? '任务已停止' : `异常: ${err.message}`,
          durationMs: totalSec * 1000,
          taskUrl: buildTaskUrl(project, task._id),
          pendingCount,
        })
        void sendWecomMessage(project.webhookUrl, failMsg).catch(() => undefined)
      }

      this.emit('task:failed', task._id, err.message)
    } finally {
      this.runningTasks.delete(task._id)
      this.stoppedTaskIds.delete(task._id)
      this._logWriteTimers.delete(task._id)
      this._pendingLogs.delete(task._id)
      this.emit('status', this.getStatus())
    }
  }

  private _logWriteTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private _pendingLogs = new Map<string, LogEntry[]>()

  private _throttledLogWrite(taskId: string, logs: LogEntry[]): void {
    this._pendingLogs.set(taskId, [...logs])
    if (this._logWriteTimers.has(taskId)) return

    const timer = setTimeout(() => {
      this._flushLogWrite(taskId, this._pendingLogs.get(taskId) ?? [])
      this._logWriteTimers.delete(taskId)
    }, 2000)
    this._logWriteTimers.set(taskId, timer)
  }

  private async _flushLogWrite(taskId: string, logs: LogEntry[]): Promise<void> {
    const existing = this._logWriteTimers.get(taskId)
    if (existing) {
      clearTimeout(existing)
      this._logWriteTimers.delete(taskId)
    }
    this._pendingLogs.delete(taskId)
    try {
      const taskRepo = createTaskRepository(this.db)
      await taskRepo.update(taskId, { logs })
      // 发射日志更新事件，通知前端
      this.emit('task:logs_updated', taskId, logs)
    } catch (err) {
      console.error('[engine] flush logs failed:', err)
    }
  }
}
