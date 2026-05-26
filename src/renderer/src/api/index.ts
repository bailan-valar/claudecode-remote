import type { Api } from '../../../preload/index'

const isElectron = typeof window !== 'undefined' && !!(window as any).api

async function httpInvoke(method: string, path: string, body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(path, options)
  return res.json()
}

let sseSource: EventSource | null = null
const sseListeners = new Map<string, Set<(...args: any[]) => void>>()

function ensureSse(): EventSource {
  if (!sseSource || sseSource.readyState === EventSource.CLOSED) {
    sseSource = new EventSource('/api/events')
    sseSource.onmessage = (e) => {
      // ignore plain messages
    }
    sseSource.onerror = (err) => {
      console.warn('[sse] error:', err)
    }
    sseSource.addEventListener('sync:status', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('sync:status')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('engine:status', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('engine:status')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('engine:task:completed', (e) => {
      const payload = JSON.parse((e as MessageEvent).data)
      // payload is [taskId, result] or single value
      const args = Array.isArray(payload) ? payload : [payload]
      sseListeners.get('engine:task:completed')?.forEach((cb) => cb(...args))
    })
    sseSource.addEventListener('engine:task:failed', (e) => {
      const payload = JSON.parse((e as MessageEvent).data)
      const args = Array.isArray(payload) ? payload : [payload]
      sseListeners.get('engine:task:failed')?.forEach((cb) => cb(...args))
    })
    sseSource.addEventListener('engine:task:logs_updated', (e) => {
      const payload = JSON.parse((e as MessageEvent).data)
      const args = Array.isArray(payload) ? payload : [payload]
      sseListeners.get('engine:task:logs_updated')?.forEach((cb) => cb(...args))
    })
    sseSource.addEventListener('task:created', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('task:created')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('task:updated', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('task:updated')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('task:deleted', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('task:deleted')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('project:created', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('project:created')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('project:updated', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('project:updated')?.forEach((cb) => cb(data))
    })
    sseSource.addEventListener('project:deleted', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      sseListeners.get('project:deleted')?.forEach((cb) => cb(data))
    })
  }
  return sseSource
}

function registerSseListener(event: string, cb: (...args: any[]) => void): () => void {
  ensureSse()
  if (!sseListeners.has(event)) {
    sseListeners.set(event, new Set())
  }
  sseListeners.get(event)!.add(cb)
  return () => {
    sseListeners.get(event)?.delete(cb)
    if (sseListeners.get(event)?.size === 0) {
      sseListeners.delete(event)
    }
    if (sseListeners.size === 0 && sseSource) {
      sseSource.close()
      sseSource = null
    }
  }
}

const httpApi: Api = {
  onSyncStatus: (cb) => registerSseListener('sync:status', cb),
  refreshSync: () => httpInvoke('POST', '/api/sync/refresh'),

  getConfig: () => httpInvoke('GET', '/api/config'),
  saveConfig: (config) => httpInvoke('POST', '/api/config', config),
  resetConfig: () => httpInvoke('POST', '/api/config/reset'),

  login: (username, password) => httpInvoke('POST', '/api/auth/login', { username, password }),
  register: (username, password) => httpInvoke('POST', '/api/auth/register', { username, password }),
  logout: () => httpInvoke('POST', '/api/auth/logout'),
  getSession: () => httpInvoke('GET', '/api/auth/session'),

  listProjects: () => httpInvoke('GET', '/api/projects'),
  createProject: (doc) => httpInvoke('POST', '/api/projects', doc),
  updateProject: (id, doc) => httpInvoke('PATCH', `/api/projects/${id}`, doc),
  deleteProject: (id) => httpInvoke('DELETE', `/api/projects/${id}`),

  listTasks: (projectId?) => {
    const url = projectId ? `/api/tasks?projectId=${encodeURIComponent(projectId)}` : '/api/tasks'
    return httpInvoke('GET', url)
  },
  createTask: (doc) => httpInvoke('POST', '/api/tasks', doc),
  updateTask: (id, doc) => httpInvoke('PATCH', `/api/tasks/${id}`, doc),
  deleteTask: (id) => httpInvoke('DELETE', `/api/tasks/${id}`),
  resumeTask: (id) => httpInvoke('POST', `/api/tasks/${id}/resume`),

  getEngineStatus: () => httpInvoke('GET', '/api/engine/status'),
  startEngine: () => httpInvoke('POST', '/api/engine/start'),
  stopEngine: () => httpInvoke('POST', '/api/engine/stop'),
  pauseEngine: () => httpInvoke('POST', '/api/engine/pause'),
  resumeEngine: () => httpInvoke('POST', '/api/engine/resume'),
  setEngineConcurrency: (n) => httpInvoke('POST', '/api/engine/concurrency', { n }),
  listEngineProviders: () => httpInvoke('GET', '/api/engine/providers'),
  getEngineProvider: () => httpInvoke('GET', '/api/engine/provider'),
  setEngineProvider: (name) => httpInvoke('POST', '/api/engine/provider', { name }),
  onEngineStatus: (cb) => registerSseListener('engine:status', cb),
  onEngineTaskCompleted: (cb) => registerSseListener('engine:task:completed', cb),
  onEngineTaskFailed: (cb) => registerSseListener('engine:task:failed', cb),
  onEngineTaskLogsUpdated: (cb) => registerSseListener('engine:task:logs_updated', cb),

  onTaskCreated: (cb) => registerSseListener('task:created', cb),
  onTaskUpdated: (cb) => registerSseListener('task:updated', cb),
  onTaskDeleted: (cb) => registerSseListener('task:deleted', cb),
  onProjectCreated: (cb) => registerSseListener('project:created', cb),
  onProjectUpdated: (cb) => registerSseListener('project:updated', cb),
  onProjectDeleted: (cb) => registerSseListener('project:deleted', cb),

  selectDirectory: () => Promise.resolve({ ok: false, error: '浏览器不支持系统目录选择' }),

  testWebhook: (webhookUrl) => httpInvoke('POST', '/api/webhook/test', { webhookUrl }),

  chatWithClaude: (projectId, message, sessionId?) =>
    httpInvoke('POST', '/api/claude/chat', { projectId, message, sessionId }),
  abortClaudeChat: () => Promise.resolve({ ok: false, error: 'Web 端暂不支持中断' }),
  getChatHistory: (projectId) =>
    httpInvoke('GET', `/api/claude/history?projectId=${encodeURIComponent(projectId)}`),
  saveChatMessage: (message) =>
    httpInvoke('POST', '/api/claude/messages', message),
  clearChatHistory: (projectId) =>
    httpInvoke('DELETE', `/api/claude/history?projectId=${encodeURIComponent(projectId)}`),
  onClaudeChatLog: (cb) => registerSseListener('claude:chat:log', cb),
  onClaudeChatDone: (cb) => registerSseListener('claude:chat:done', cb),

  executeTerminalCommand: (projectId, command, workingDir?) =>
    httpInvoke('POST', '/api/terminal/execute', { projectId, command, workingDir }),
}

export const apiClient: Api = isElectron ? (window as any).api : httpApi
