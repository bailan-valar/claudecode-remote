import { contextBridge, ipcRenderer } from 'electron'

export type SyncStatus =
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

const api = {
  onSyncStatus: (cb: (status: SyncStatus) => void) => {
    const listener = (_: unknown, status: SyncStatus) => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.off('sync:status', listener)
  },
  refreshSync: () => ipcRenderer.invoke('sync:refresh'),
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
