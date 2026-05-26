import { syncManager, authManager, getEngine, setEngine } from './index'
import { createProjectRepository } from './repositories/projectRepository'
import { createTaskRepository } from './repositories/taskRepository'
import { createChatRepository, createChatSessionRepository } from './repositories/chatRepository'
import { TaskEngine } from './engine/taskEngine'
import { loadEngineState, saveEngineState } from './engineState'
import { listRunners } from './engine/runnerRegistry'
import { computeTimeTrackingChanges } from './utils/taskTimeTracking'
import type { TimeEntry } from './utils/taskTimeTracking'
import { broadcast } from './events'
import { sendWecomMessage, buildTestMessage } from './engine/wecomNotifier'
import { runClaudeChat } from './engine/claudeRunner'
import { saveCredentials, loadCredentials, clearCredentials } from './credentialStore'
import type { Project, Task, ChatMessage } from '../shared/types'
import type { LogEntry } from './engine/runner'

function setupEngine(db: PouchDB.Database, options: { concurrency?: number; provider?: string }): TaskEngine {
  const oldEngine = getEngine()
  const provider = options.provider ?? oldEngine?.getProvider?.() ?? loadEngineState().provider
  oldEngine?.stop?.()

  const engine = new TaskEngine({ db, concurrency: options.concurrency ?? 1, provider })
  engine.on('status', (status) => broadcast('engine:status', status))
  engine.on('task:completed', (taskId, result) => broadcast('engine:task:completed', taskId, result))
  engine.on('task:failed', (taskId, error) => broadcast('engine:task:failed', taskId, error))

  setEngine(engine)
  return engine
}

// === Auth ===

export async function registerAction(username: string, password: string) {
  console.log('[api] auth:register', username)
  try {
    await authManager.signUp(username, password)
    console.log('[api] auth:register ok')
    return { ok: true }
  } catch (err: any) {
    console.error('[api] auth:register failed:', err.message)
    return { ok: false, error: err.message || '注册失败' }
  }
}

export async function loginAction(username: string, password: string) {
  console.log('[api] auth:login', username)
  try {
    const user = await authManager.logIn(username, password)
    await syncManager.switchToUser(username, password)
    const db = syncManager.getLocalDb()
    if (db) {
      const state = loadEngineState()
      const engine = setupEngine(db, { provider: state.provider })
      if (state.running) {
        engine.start()
      }
    }
    saveCredentials(username, password)
    console.log('[api] auth:login ok')
    return { ok: true, user }
  } catch (err: any) {
    console.error('[api] auth:login failed:', err.message)
    return { ok: false, error: err.message || '登录失败' }
  }
}

export async function logoutAction() {
  console.log('[api] auth:logout')
  try {
    getEngine()?.stop?.()
    setEngine(null)
    await authManager.logOut()
    syncManager.logout()
    clearCredentials()
    console.log('[api] auth:logout ok')
    return { ok: true }
  } catch (err: any) {
    console.error('[api] auth:logout failed:', err.message)
    return { ok: false, error: err.message || '注销失败' }
  }
}

export async function getSessionAction() {
  try {
    let user = await authManager.getSession()
    if (!user) {
      const creds = loadCredentials()
      if (creds) {
        console.log('[api] auto-login with stored credentials')
        const result = await loginAction(creds.username, creds.password)
        if (result.ok && result.user) {
          user = result.user
        }
      }
    }
    return { user }
  } catch (err: any) {
    console.error('[api] getSession failed:', err.message)
    return { user: null }
  }
}

// === Projects ===

export async function listProjectsAction() {
  console.log('[api] project:list')
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const projects = await repo.findAll()
  console.log('[api] project:list ok, count=', projects.length)
  return { ok: true, projects }
}

export async function createProjectAction(doc: Omit<Project, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) {
  console.log('[api] project:create', (doc as any).name)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const now = new Date().toISOString()
  const project = await repo.create({
    ...doc,
    type: 'project',
    createdAt: now,
    updatedAt: now,
  })
  console.log('[api] project:create ok', project._id)
  broadcast('project:created', project)
  return { ok: true, project }
}

export async function updateProjectAction(id: string, changes: Partial<Project>) {
  console.log('[api] project:update', id, changes)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const project = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() })
  console.log('[api] project:update ok', project._rev)
  broadcast('project:updated', project)
  return { ok: true, project }
}

export async function deleteProjectAction(id: string) {
  console.log('[api] project:delete', id)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  await repo.delete(id)
  console.log('[api] project:delete ok')
  broadcast('project:deleted', id)
  return { ok: true }
}

// === Tasks ===

export async function listTasksAction(projectId?: string) {
  console.log('[api] task:list', projectId || '(all)')
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createTaskRepository(db)
  let tasks = await repo.findAll()
  if (projectId) {
    tasks = tasks.filter((t) => t.projectId === projectId)
  }
  // 按更新时间倒序排列（最新的在前）
  tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  console.log('[api] task:list ok, count=', tasks.length)
  return { ok: true, tasks }
}

export async function createTaskAction(doc: Omit<Task, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'logs' | 'createdVia' | 'priority' | 'timeEntries' | 'totalDuration' | 'kind'> & { status?: Task['status']; priority?: Task['priority']; kind?: Task['kind'] }) {
  console.log('[api] task:create', (doc as any).title)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createTaskRepository(db)
  const now = new Date().toISOString()
  const initialStatus = doc.status || (doc.isPlan ? 'plan_required' : 'pending')
  const timeEntries: TimeEntry[] = []
  let totalDuration = 0
  if (initialStatus === 'developing') {
    timeEntries.push({ startedAt: now, status: initialStatus })
  }
  const statusHistory = [{ status: initialStatus, startedAt: now }]
  const task = await repo.create({
    ...doc,
    type: 'task',
    status: initialStatus,
    priority: doc.priority || 'medium',
    kind: doc.kind || 'task',
    logs: [],
    createdAt: now,
    updatedAt: now,
    createdVia: 'desktop',
    timeEntries,
    totalDuration,
    statusHistory,
  } as any)
  console.log('[api] task:create ok', task._id)
  broadcast('task:created', task)
  return { ok: true, task }
}

export async function updateTaskAction(id: string, changes: Partial<Task>) {
  console.log('[api] task:update', id, changes)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createTaskRepository(db)

  let merged = { ...changes }
  if (changes.status) {
    const existing = await repo.findById(id)
    if (existing) {
      const timeChanges = computeTimeTrackingChanges(existing, changes.status)
      merged = { ...merged, ...timeChanges }
    }
  }

  const task = await repo.update(id, { ...merged, updatedAt: new Date().toISOString() })
  console.log('[api] task:update ok', task._rev)
  broadcast('task:updated', task)
  return { ok: true, task }
}

export async function deleteTaskAction(id: string) {
  console.log('[api] task:delete', id)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createTaskRepository(db)
  await repo.delete(id)
  console.log('[api] task:delete ok')
  broadcast('task:deleted', id)
  return { ok: true }
}

export async function resumeTaskAction(id: string) {
  console.log('[api] task:resume', id)
  const engine = getEngine()
  if (!engine) {
    return { ok: false, error: '引擎未初始化' }
  }
  const result = await engine.resumeTask(id)
  console.log('[api] task:resume', result.ok ? 'ok' : 'failed:', result.error)
  return result
}

// === Engine ===

export async function getEngineStatusAction() {
  const engine = getEngine()
  return { ok: true, status: engine?.getStatus() ?? { running: false, runningCount: 0, queueSize: 0, currentTaskIds: [], concurrency: 1, provider: 'anthropic' } }
}

export async function startEngineAction() {
  const engine = getEngine()
  if (engine) {
    engine.start()
    saveEngineState({ running: true, concurrency: engine.concurrency, provider: engine.getProvider() })
    return { ok: true }
  }
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const state = loadEngineState()
  const newEngine = setupEngine(db, { concurrency: state.concurrency ?? 1, provider: state.provider })
  newEngine.start()
  saveEngineState({ running: true, concurrency: newEngine.concurrency, provider: newEngine.getProvider() })
  return { ok: true }
}

export async function stopEngineAction() {
  const engine = getEngine()
  if (engine) {
    engine.stop()
    saveEngineState({ running: false, concurrency: engine.concurrency, provider: engine.getProvider() })
  }
  return { ok: true }
}

export async function pauseEngineAction() {
  getEngine()?.pause?.()
  return { ok: true }
}

export async function resumeEngineAction() {
  getEngine()?.resume?.()
  return { ok: true }
}

export async function setEngineConcurrencyAction(n: number) {
  const engine = getEngine()
  if (engine) {
    engine.setConcurrency(n)
    saveEngineState({ running: engine.running, concurrency: n, provider: engine.getProvider() })
  }
  return { ok: true }
}

export async function listEngineProvidersAction() {
  return { ok: true, providers: listRunners() }
}

export async function getEngineProviderAction() {
  const engine = getEngine()
  return { ok: true, provider: engine?.getProvider?.() ?? loadEngineState().provider ?? 'anthropic' }
}

export async function setEngineProviderAction(name: string) {
  const engine = getEngine()
  if (engine) {
    engine.setProvider(name)
    saveEngineState({ running: engine.running, concurrency: engine.concurrency, provider: name })
  } else {
    const state = loadEngineState()
    saveEngineState({ running: state.running, concurrency: state.concurrency, provider: name })
  }
  return { ok: true }
}

// === CouchDB Connection Test ===

export async function testCouchdbConnectionAction(config: { url: string; adminUser?: string; adminPassword?: string }) {
  console.log('[api] config:test-couchdb', config.url)
  try {
    const baseUrl = config.url.replace(/\/$/, '')
    const testUrl = `${baseUrl}/`

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (config.adminUser && config.adminPassword) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString('base64')
    }

    const response = await fetch(testUrl, { headers })

    if (response.ok) {
      const data = await response.json()
      console.log('[api] config:test-couchdb ok', data.version)
      return { ok: true, version: data.version }
    }

    const errorText = await response.text().catch(() => 'Unknown error')
    console.error('[api] config:test-couchdb failed', response.status, errorText)

    if (response.status === 401) {
      return { ok: false, error: '认证失败：用户名或密码错误' }
    }
    if (response.status === 404) {
      return { ok: false, error: 'CouchDB 服务器未找到，请检查 URL' }
    }
    if (response.status === 0 || response.type === 'opaque') {
      return { ok: false, error: '无法连接到服务器，请检查网络和 CORS 设置' }
    }

    return { ok: false, error: `连接失败 (${response.status}): ${errorText}` }
  } catch (err: any) {
    console.error('[api] config:test-couchdb error:', err.message)
    return { ok: false, error: err.message || '连接失败' }
  }
}

// === Webhook ===

export async function testWebhookAction(webhookUrl: string) {
  console.log('[api] webhook:test', webhookUrl ? webhookUrl.slice(0, 60) + '...' : '(empty)')
  if (!webhookUrl) {
    return { ok: false, error: 'Webhook URL 为空' }
  }
  const result = await sendWecomMessage(webhookUrl, buildTestMessage())
  if (result.success) {
    console.log('[api] webhook:test ok')
    return { ok: true }
  }
  console.error('[api] webhook:test failed:', result.error)
  return { ok: false, error: result.error || '发送失败' }
}

// === Claude Chat ===

const chatControllers = new Map<string, AbortController>()

export async function chatWithClaudeAction(projectId: string, message: string, sessionId?: string) {
  console.log('[api] claude:chat', projectId, message.slice(0, 60))
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const project = await repo.findById(projectId)
  if (!project) return { ok: false, error: '项目不存在' }

  const controller = new AbortController()
  const chatId = Math.random().toString(36).slice(2)
  chatControllers.set(chatId, controller)

  try {
    const result = await runClaudeChat(project, message, sessionId, {
      onLog: (entry: LogEntry) => {
        broadcast('claude:chat:log', entry)
      },
      abortSignal: controller.signal,
    })
    broadcast('claude:chat:done', { chatId, ...result })
    return { ok: true, chatId, ...result }
  } catch (err: any) {
    return { ok: false, error: err.message || '对话失败' }
  } finally {
    chatControllers.delete(chatId)
  }
}

export function abortClaudeChatAction(chatId?: string) {
  if (chatId) {
    chatControllers.get(chatId)?.abort()
  } else {
    for (const [, ctrl] of chatControllers) {
      ctrl.abort()
    }
  }
  return { ok: true }
}

// === Chat History ===

export async function getChatHistoryAction(projectId: string) {
  console.log('[api] chat:history', projectId)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  const chatRepo = createChatRepository(db)
  const messages = await chatRepo.findByProjectId(projectId)

  // 获取最新的会话ID
  const latestMessage = await chatRepo.findLatestSession(projectId)
  const sessionId = latestMessage?.sessionId

  console.log('[api] chat:history ok', messages.length, 'messages')
  return { ok: true, messages, sessionId }
}

export async function saveChatMessageAction(message: Omit<ChatMessage, '_id' | '_rev'>) {
  console.log('[api] chat:save', message.projectId, message.role)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  const chatRepo = createChatRepository(db)
  const now = new Date().toISOString()

  const chatMessage = await chatRepo.create({
    ...message,
    timestamp: message.timestamp || now,
  })

  console.log('[api] chat:save ok', chatMessage._id)
  return { ok: true, message: chatMessage }
}

export async function clearChatHistoryAction(projectId: string) {
  console.log('[api] chat:clear', projectId)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  const chatRepo = createChatRepository(db)
  await chatRepo.deleteByProjectId(projectId)

  console.log('[api] chat:clear ok')
  return { ok: true }
}

// === Data Export/Import ===

export interface DataExport {
  version: string
  exportedAt: string
  projects: Project[]
  tasks: Task[]
  chatMessages?: ChatMessage[]
}

export async function exportDataAction() {
  console.log('[api] data:export')
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  try {
    const projectRepo = createProjectRepository(db)
    const taskRepo = createTaskRepository(db)
    const chatRepo = createChatRepository(db)

    const projects = await projectRepo.findAll()
    const tasks = await taskRepo.findAll()
    const chatMessages = await chatRepo.findAll()

    const data: DataExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects,
      tasks,
      chatMessages,
    }

    console.log('[api] data:export ok', { projects: projects.length, tasks: tasks.length })
    return { ok: true, data }
  } catch (err: any) {
    console.error('[api] data:export error:', err.message)
    return { ok: false, error: err.message || '导出失败' }
  }
}

export interface ImportOptions {
  mergeMode?: boolean // true=合并（保留现有数据）, false=覆盖（删除后导入）
  skipConflicts?: boolean // true=跳过冲突, false=覆盖冲突数据
}

export interface ImportResult {
  projectsCreated: number
  projectsUpdated: number
  projectsSkipped: number
  tasksCreated: number
  tasksUpdated: number
  tasksSkipped: number
  chatMessagesImported: number
  errors: string[]
}

export async function importDataAction(
  data: DataExport,
  options: ImportOptions = {}
) {
  console.log('[api] data:import', options)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  const result: ImportResult = {
    projectsCreated: 0,
    projectsUpdated: 0,
    projectsSkipped: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    tasksSkipped: 0,
    chatMessagesImported: 0,
    errors: [],
  }

  const mergeMode = options.mergeMode ?? true
  const skipConflicts = options.skipConflicts ?? false

  try {
    const projectRepo = createProjectRepository(db)
    const taskRepo = createTaskRepository(db)
    const chatRepo = createChatRepository(db)

    // 导入项目
    for (const project of data.projects) {
      try {
        const existing = await projectRepo.findById(project._id)
        if (existing) {
          if (skipConflicts) {
            result.projectsSkipped++
          } else {
            await projectRepo.update(project._id, project)
            result.projectsUpdated++
          }
        } else {
          await projectRepo.create(project)
          result.projectsCreated++
        }
      } catch (err: any) {
        result.errors.push(`项目 ${project.name || project._id} 导入失败: ${err.message}`)
      }
    }

    // 导入任务
    for (const task of data.tasks) {
      try {
        const existing = await taskRepo.findById(task._id)
        if (existing) {
          if (skipConflicts) {
            result.tasksSkipped++
          } else {
            await taskRepo.update(task._id, task)
            result.tasksUpdated++
          }
        } else {
          await taskRepo.create(task)
          result.tasksCreated++
        }
      } catch (err: any) {
        result.errors.push(`任务 ${task.title || task._id} 导入失败: ${err.message}`)
      }
    }

    // 导入聊天记录
    if (data.chatMessages) {
      for (const msg of data.chatMessages) {
        try {
          await chatRepo.create(msg)
          result.chatMessagesImported++
        } catch (err: any) {
          result.errors.push(`聊天消息导入失败: ${err.message}`)
        }
      }
    }

    console.log('[api] data:import ok', result)
    return { ok: true, result }
  } catch (err: any) {
    console.error('[api] data:import error:', err.message)
    return { ok: false, error: err.message || '导入失败', result }
  }
}

// === Terminal ===

import { spawn } from 'child_process'
import { promisify } from 'util'

export async function executeTerminalCommandAction(projectId: string, command: string, workingDir?: string) {
  console.log('[api] terminal:execute', projectId, command.slice(0, 60))

  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }

  const repo = createProjectRepository(db)
  const project = await repo.findById(projectId)
  if (!project) return { ok: false, error: '项目不存在' }

  const cwd = workingDir || project.path
  if (!cwd) return { ok: false, error: '项目路径未配置' }

  return new Promise((resolve) => {
    const startTime = Date.now()
    let stdout = ''
    let stderr = ''
    let combinedOutput = ''

    // 解析命令和参数
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]
    const args = parts.slice(1)

    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env },
    })

    child.stdout?.on('data', (data) => {
      const text = data.toString()
      stdout += text
      combinedOutput += text
    })

    child.stderr?.on('data', (data) => {
      const text = data.toString()
      stderr += text
      combinedOutput += text
    })

    child.on('close', (code) => {
      const duration = Date.now() - startTime
      console.log('[api] terminal:execute done', { exitCode: code, duration })

      resolve({
        ok: true,
        exitCode: code || 0,
        stdout,
        stderr,
        combinedOutput,
        duration,
      })
    })

    child.on('error', (error) => {
      console.error('[api] terminal:execute error:', error.message)
      resolve({
        ok: false,
        error: error.message,
        exitCode: -1,
        stdout,
        stderr,
        combinedOutput: stderr + error.message,
        duration: Date.now() - startTime,
      })
    })
  })
}
