import { EventEmitter } from 'node:events'
import PQueueModule from 'p-queue'
const PQueue = (PQueueModule as any).default || PQueueModule
import type PouchDB from 'pouchdb'
import type { LogEntry } from './runner'
import { getRunner } from './runnerRegistry'
import { autoCommit } from './gitAutoCommit'
import { createTaskRepository } from '../repositories/taskRepository'
import { createProjectRepository } from '../repositories/projectRepository'
import { sendWecomMessage, buildTaskCompletedMarkdown } from './wecomNotifier'
import { computeTimeTrackingChanges } from '../utils/taskTimeTracking'
import type { Task } from '../../shared/types'
import { TASK_STATUS } from '../../shared/constants'

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
    return this._provider ?? 'anthropic'
  }

  setProvider(name: string): void {
    this._provider = name
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

    this._scanPending()

    this.changesFeed = this.db
      .changes({ live: true, since: 'now', include_docs: true })
      .on('change', (change) => {
        const doc = change.doc as any
        if (!doc || doc.type !== 'task') return
        if (doc.status === TASK_STATUS.PENDING) {
          this._enqueue(doc as Task)
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

    for (const [, ctrl] of this.runningTasks) {
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

  private async _scanPending(): Promise<void> {
    const taskRepo = createTaskRepository(this.db)
    const tasks = await taskRepo.findAll()
    const pending = tasks.filter((t) => t.status === TASK_STATUS.PENDING)
    for (const task of pending) {
      this._enqueue(task)
    }
  }

  private _enqueue(task: Task): void {
    if (!this._running) return
    if (this.runningTasks.has(task._id)) return

    this.queue.add(async () => {
      await this._executeWithProjectLock(task)
    })

    this.emit('status', this.getStatus())
  }

  private async _executeWithProjectLock(task: Task): Promise<void> {
    // 等待同项目的上一个任务完成（项目级串行）
    const prevLock = this.projectLocks.get(task.projectId)
    if (prevLock) {
      await prevLock
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
    const taskRepo = createTaskRepository(this.db)
    const projectRepo = createProjectRepository(this.db)

    const latestTask = await taskRepo.findById(task._id) ?? task

    const project = await projectRepo.findById(task.projectId)
    if (!project) {
      console.error('[engine] project not found:', task.projectId)
      const timeChanges = computeTimeTrackingChanges(latestTask, TASK_STATUS.PENDING)
      await taskRepo.update(task._id, {
        status: TASK_STATUS.PENDING,
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

    const startTimeChanges = computeTimeTrackingChanges(latestTask, TASK_STATUS.DEVELOPING)
    await taskRepo.update(task._id, {
      status: TASK_STATUS.DEVELOPING,
      claudeSessionId: inheritedSessionId,
      updatedAt: new Date().toISOString(),
      ...startTimeChanges,
    })
    this.emit('task:started', task._id)

    const controller = new AbortController()
    this.runningTasks.set(task._id, controller)
    this.emit('status', this.getStatus())

    const logs: LogEntry[] = [...(task.logs ?? [])]
    const taskWithSession: Task = { ...task, claudeSessionId: inheritedSessionId }

    try {
      const runner = getRunner(this._provider ?? project.llmConfig?.provider)
      console.log(`[engine] 使用执行引擎: ${runner.name} (provider=${this._provider ?? project.llmConfig?.provider ?? 'anthropic'})`)
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
        const commitResult = await autoCommit(project.path, task.title)
        const commitLog: LogEntry = {
          timestamp: new Date().toISOString(),
          level: commitResult.success ? 'info' : 'warn',
          message: commitResult.success
            ? `[Git] ${commitResult.message}`
            : `[Git] ${commitResult.error}`,
        }
        logs.push(commitLog)

        const currentTask = await taskRepo.findById(task._id) ?? latestTask
        const endTimeChanges = computeTimeTrackingChanges(currentTask, TASK_STATUS.REVIEWING)
        await taskRepo.update(task._id, {
          status: TASK_STATUS.REVIEWING,
          claudeSessionId: result.sessionId ?? inheritedSessionId,
          logs,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...endTimeChanges,
        })

        // 企业微信通知（非阻塞）
        if (project.webhookEnabled && project.webhookUrl) {
          const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
          const msg = buildTaskCompletedMarkdown({
            projectName: project.name,
            taskTitle: task.title,
            taskId: task._id,
            status: '待审核',
            prompt: task.prompt,
            logsCount: logs.length,
            commitMessage: commitResult.success ? commitResult.message : undefined,
            durationMs: totalSec * 1000,
          })
          void sendWecomMessage(project.webhookUrl, msg).then((res) => {
            if (!res.success) {
              console.error('[wecom] 通知发送失败:', res.error)
            } else {
              console.log('[wecom] 通知已发送')
            }
          })
        }

        this.emit('task:completed', task._id, result)
      } else {
        const currentTask = await taskRepo.findById(task._id) ?? latestTask
        const endTimeChanges = computeTimeTrackingChanges(currentTask, TASK_STATUS.PENDING)
        await taskRepo.update(task._id, {
          status: TASK_STATUS.PENDING,
          reviewFeedback: result.error ?? '执行失败',
          claudeSessionId: result.sessionId ?? inheritedSessionId,
          logs,
          updatedAt: new Date().toISOString(),
          ...endTimeChanges,
        })
        this.emit('task:failed', task._id, result.error)
      }
    } catch (err: any) {
      const currentTask = await taskRepo.findById(task._id) ?? latestTask
      const endTimeChanges = computeTimeTrackingChanges(currentTask, TASK_STATUS.PENDING)
      await taskRepo.update(task._id, {
        status: TASK_STATUS.PENDING,
        reviewFeedback: `异常: ${err.message}`,
        logs,
        updatedAt: new Date().toISOString(),
        ...endTimeChanges,
      })
      this.emit('task:failed', task._id, err.message)
    } finally {
      this.runningTasks.delete(task._id)
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
    } catch (err) {
      console.error('[engine] flush logs failed:', err)
    }
  }
}
