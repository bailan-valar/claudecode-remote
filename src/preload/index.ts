import { contextBridge, ipcRenderer } from 'electron'
import type { Project, Task, ChatMessage, LlmProvider } from '../shared/types'
import type { LogEntry } from '../main/engine/runner'
import type { AppConfig } from '../main/configStore'

export type SyncStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

const api = {
  // === Phase 1 已有 ===
  onSyncStatus: (cb: (status: SyncStatus) => void): (() => void) => {
    const listener = (_: unknown, status: SyncStatus) => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => { ipcRenderer.off('sync:status', listener) }
  },
  refreshSync: () => ipcRenderer.invoke('sync:refresh'),

  // === Config ===
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('config:save', config),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  testCouchdbConnection: (config: { url: string; adminUser?: string; adminPassword?: string }) =>
    ipcRenderer.invoke('config:test-couchdb', config),

  // === Projects ===
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (doc: Omit<Project, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('project:create', doc),
  updateProject: (id: string, doc: Partial<Project>) =>
    ipcRenderer.invoke('project:update', id, doc),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // === Tasks ===
  listTasks: (projectId?: string) => ipcRenderer.invoke('task:list', projectId),
  createTask: (doc: Omit<Task, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'logs' | 'createdVia' | 'priority' | 'kind'> & { status?: Task['status']; kind?: Task['kind'] }) =>
    ipcRenderer.invoke('task:create', doc),
  updateTask: (id: string, doc: Partial<Task>) =>
    ipcRenderer.invoke('task:update', id, doc),
  deleteTask: (id: string) => ipcRenderer.invoke('task:delete', id),
  resumeTask: (id: string) => ipcRenderer.invoke('task:resume', id),
  stopTask: (id: string) => ipcRenderer.invoke('task:stop', id),
  addTaskLog: (id: string, message: string) => ipcRenderer.invoke('task:addLog', id, message),

  // === Engine ===
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  pauseEngine: () => ipcRenderer.invoke('engine:pause'),
  resumeEngine: () => ipcRenderer.invoke('engine:resume'),
  setEngineConcurrency: (n: number) => ipcRenderer.invoke('engine:setConcurrency', n),
  listEngineProviders: () => ipcRenderer.invoke('engine:listProviders'),
  getEngineProvider: () => ipcRenderer.invoke('engine:getProvider'),
  setEngineProvider: (name: string) => ipcRenderer.invoke('engine:setProvider', name),
  onEngineStatus: (cb: (status: any) => void): (() => void) => {
    const listener = (_: unknown, status: any) => cb(status)
    ipcRenderer.on('engine:status', listener)
    return () => { ipcRenderer.off('engine:status', listener) }
  },
  onEngineTaskCompleted: (cb: (taskId: string, result: any) => void): (() => void) => {
    const listener = (_: unknown, taskId: string, result: any) => cb(taskId, result)
    ipcRenderer.on('engine:task:completed', listener)
    return () => { ipcRenderer.off('engine:task:completed', listener) }
  },
  onEngineTaskFailed: (cb: (taskId: string, error: string) => void): (() => void) => {
    const listener = (_: unknown, taskId: string, error: string) => cb(taskId, error)
    ipcRenderer.on('engine:task:failed', listener)
    return () => { ipcRenderer.off('engine:task:failed', listener) }
  },
  onEngineTaskLogsUpdated: (cb: (taskId: string, logs: any[]) => void): (() => void) => {
    const listener = (_: unknown, taskId: string, logs: any[]) => cb(taskId, logs)
    ipcRenderer.on('engine:task:logs_updated', listener)
    return () => { ipcRenderer.off('engine:task:logs_updated', listener) }
  },

  // === Task/Project Change Events ===
  onTaskCreated: (cb: (task: Task) => void): (() => void) => {
    const listener = (_: unknown, task: Task) => cb(task)
    ipcRenderer.on('task:created', listener)
    return () => { ipcRenderer.off('task:created', listener) }
  },
  onTaskUpdated: (cb: (task: Task) => void): (() => void) => {
    const listener = (_: unknown, task: Task) => cb(task)
    ipcRenderer.on('task:updated', listener)
    return () => { ipcRenderer.off('task:updated', listener) }
  },
  onTaskDeleted: (cb: (id: string) => void): (() => void) => {
    const listener = (_: unknown, id: string) => cb(id)
    ipcRenderer.on('task:deleted', listener)
    return () => { ipcRenderer.off('task:deleted', listener) }
  },
  onProjectCreated: (cb: (project: Project) => void): (() => void) => {
    const listener = (_: unknown, project: Project) => cb(project)
    ipcRenderer.on('project:created', listener)
    return () => { ipcRenderer.off('project:created', listener) }
  },
  onProjectUpdated: (cb: (project: Project) => void): (() => void) => {
    const listener = (_: unknown, project: Project) => cb(project)
    ipcRenderer.on('project:updated', listener)
    return () => { ipcRenderer.off('project:updated', listener) }
  },
  onProjectDeleted: (cb: (id: string) => void): (() => void) => {
    const listener = (_: unknown, id: string) => cb(id)
    ipcRenderer.on('project:deleted', listener)
    return () => { ipcRenderer.off('project:deleted', listener) }
  },

  // === Claude Chat ===
  chatWithClaude: (projectId: string, message: string, sessionId?: string) =>
    ipcRenderer.invoke('claude:chat', projectId, message, sessionId),
  abortClaudeChat: () => ipcRenderer.invoke('claude:chat:abort'),
  getChatHistory: (projectId: string) => ipcRenderer.invoke('claude:history', projectId),
  saveChatMessage: (message: Omit<ChatMessage, '_id' | '_rev'>) => ipcRenderer.invoke('claude:messages:save', message),
  clearChatHistory: (projectId: string) => ipcRenderer.invoke('claude:history:clear', projectId),
  onClaudeChatLog: (cb: (entry: LogEntry) => void): (() => void) => {
    const listener = (_: unknown, entry: LogEntry) => cb(entry)
    ipcRenderer.on('claude:chat:log', listener)
    return () => { ipcRenderer.off('claude:chat:log', listener) }
  },
  onClaudeChatDone: (cb: (result: any) => void): (() => void) => {
    const listener = (_: unknown, result: any) => cb(result)
    ipcRenderer.on('claude:chat:done', listener)
    return () => { ipcRenderer.off('claude:chat:done', listener) }
  },

  // === Dialog ===
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),

  // === Terminal ===
  executeTerminalCommand: (projectId: string, command: string, workingDir?: string) =>
    ipcRenderer.invoke('terminal:execute', projectId, command, workingDir),

  // === Git Push ===
  gitPush: (projectId: string, remote?: string, branch?: string) =>
    ipcRenderer.invoke('git:push', projectId, remote, branch),

  // === Webhook ===
  testWebhook: (webhookUrl: string) => ipcRenderer.invoke('webhook:test', webhookUrl),

  // === Data Export/Import ===
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (data: any, options?: { mergeMode?: boolean; skipConflicts?: boolean }) =>
    ipcRenderer.invoke('data:import', data, options),

  // === Instance Info ===
  getInstanceInfo: () => ipcRenderer.invoke('instance:info'),

  // === LLM Providers ===
  listLlmProviders: () => ipcRenderer.invoke('llm:providers:list'),
  getLlmProvider: (id: string) => ipcRenderer.invoke('llm:providers:get', id),
  getDefaultLlmProvider: () => ipcRenderer.invoke('llm:providers:getDefault'),
  addLlmProvider: (provider: Omit<LlmProvider, 'id' | 'createdAt'>) =>
    ipcRenderer.invoke('llm:providers:add', provider),
  updateLlmProvider: (id: string, updates: Partial<Omit<LlmProvider, 'id' | 'createdAt'>>) =>
    ipcRenderer.invoke('llm:providers:update', id, updates),
  deleteLlmProvider: (id: string) => ipcRenderer.invoke('llm:providers:delete', id),
  setDefaultLlmProvider: (id: string) => ipcRenderer.invoke('llm:providers:setDefault', id),
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
export type { AppConfig, LlmProvider }
