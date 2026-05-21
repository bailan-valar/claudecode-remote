import { contextBridge, ipcRenderer } from 'electron'
import type { Project, Task } from '../shared/types'

export type SyncStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

const api = {
  // === Phase 1 已有 ===
  onSyncStatus: (cb: (status: SyncStatus) => void) => {
    const listener = (_: unknown, status: SyncStatus) => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.off('sync:status', listener)
  },
  refreshSync: () => ipcRenderer.invoke('sync:refresh'),

  // === Auth ===
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  register: (username: string, password: string) =>
    ipcRenderer.invoke('auth:register', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:session'),

  // === Projects ===
  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (doc: Omit<Project, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke('project:create', doc),
  updateProject: (id: string, doc: Partial<Project>) =>
    ipcRenderer.invoke('project:update', id, doc),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // === Tasks ===
  listTasks: (projectId?: string) => ipcRenderer.invoke('task:list', projectId),
  createTask: (doc: Omit<Task, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'logs' | 'createdVia' | 'status' | 'priority'>) =>
    ipcRenderer.invoke('task:create', doc),
  updateTask: (id: string, doc: Partial<Task>) =>
    ipcRenderer.invoke('task:update', id, doc),
  deleteTask: (id: string) => ipcRenderer.invoke('task:delete', id),

  // === Engine ===
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  pauseEngine: () => ipcRenderer.invoke('engine:pause'),
  resumeEngine: () => ipcRenderer.invoke('engine:resume'),
  setEngineConcurrency: (n: number) => ipcRenderer.invoke('engine:setConcurrency', n),
  onEngineStatus: (cb: (status: any) => void) => {
    const listener = (_: unknown, status: any) => cb(status)
    ipcRenderer.on('engine:status', listener)
    return () => ipcRenderer.off('engine:status', listener)
  },
  onEngineTaskCompleted: (cb: (taskId: string, result: any) => void) => {
    const listener = (_: unknown, taskId: string, result: any) => cb(taskId, result)
    ipcRenderer.on('engine:task:completed', listener)
    return () => ipcRenderer.off('engine:task:completed', listener)
  },
  onEngineTaskFailed: (cb: (taskId: string, error: string) => void) => {
    const listener = (_: unknown, taskId: string, error: string) => cb(taskId, error)
    ipcRenderer.on('engine:task:failed', listener)
    return () => ipcRenderer.off('engine:task:failed', listener)
  },

  // === Dialog ===
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
