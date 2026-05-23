import { syncManager, authManager, getEngine, setEngine } from './index'
import { createProjectRepository } from './repositories/projectRepository'
import { createTaskRepository } from './repositories/taskRepository'
import { TaskEngine } from './engine/taskEngine'
import { loadEngineState, saveEngineState } from './engineState'
import { listRunners } from './engine/runnerRegistry'
import { computeTimeTrackingChanges } from './utils/taskTimeTracking'
import type { TimeEntry } from './utils/taskTimeTracking'
import { broadcast } from './events'
import { sendWecomMessage, buildTestMessage } from './engine/wecomNotifier'
import { runClaudeChat } from './engine/claudeRunner'
import { saveCredentials, loadCredentials, clearCredentials } from './credentialStore'
import type { Project, Task } from '../shared/types'
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
  return { ok: true, project }
}

export async function updateProjectAction(id: string, changes: Partial<Project>) {
  console.log('[api] project:update', id, changes)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const project = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() })
  console.log('[api] project:update ok', project._rev)
  return { ok: true, project }
}

export async function deleteProjectAction(id: string) {
  console.log('[api] project:delete', id)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  await repo.delete(id)
  console.log('[api] project:delete ok')
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
  return { ok: true, task }
}

export async function deleteTaskAction(id: string) {
  console.log('[api] task:delete', id)
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createTaskRepository(db)
  await repo.delete(id)
  console.log('[api] task:delete ok')
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
