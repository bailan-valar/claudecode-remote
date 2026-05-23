import { ipcMain, BrowserWindow, dialog } from 'electron'
import { syncManager } from './index'
import * as api from './apiActions'
import { mainEvents } from './events'

export function registerIpcHandlers(win: BrowserWindow) {
  // --- Broadcast to renderer window ---
  const sendToWin = (channel: string, ...args: any[]) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  mainEvents.on('sync:status', (status) => sendToWin('sync:status', status))
  mainEvents.on('engine:status', (status) => sendToWin('engine:status', status))
  mainEvents.on('engine:task:completed', (taskId, result) => sendToWin('engine:task:completed', taskId, result))
  mainEvents.on('engine:task:failed', (taskId, error) => sendToWin('engine:task:failed', taskId, error))

  // --- Sync handlers ---
  ipcMain.removeHandler('sync:refresh')
  ipcMain.handle('sync:refresh', async () => {
    syncManager.restart()
    return { ok: true }
  })

  // --- Auth handlers ---
  ipcMain.removeHandler('auth:register')
  ipcMain.handle('auth:register', async (_, username: string, password: string) => {
    return api.registerAction(username, password)
  })

  ipcMain.removeHandler('auth:login')
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    return api.loginAction(username, password)
  })

  ipcMain.removeHandler('auth:logout')
  ipcMain.handle('auth:logout', async () => {
    return api.logoutAction()
  })

  ipcMain.removeHandler('auth:session')
  ipcMain.handle('auth:session', async () => {
    return api.getSessionAction()
  })

  // --- Project CRUD handlers ---
  ipcMain.removeHandler('project:list')
  ipcMain.handle('project:list', async () => api.listProjectsAction())

  ipcMain.removeHandler('project:create')
  ipcMain.handle('project:create', async (_, doc) => api.createProjectAction(doc))

  ipcMain.removeHandler('project:update')
  ipcMain.handle('project:update', async (_, id: string, changes) => api.updateProjectAction(id, changes))

  ipcMain.removeHandler('project:delete')
  ipcMain.handle('project:delete', async (_, id: string) => api.deleteProjectAction(id))

  // --- Task CRUD handlers ---
  ipcMain.removeHandler('task:list')
  ipcMain.handle('task:list', async (_, projectId?: string) => api.listTasksAction(projectId))

  ipcMain.removeHandler('task:create')
  ipcMain.handle('task:create', async (_, doc) => api.createTaskAction(doc))

  ipcMain.removeHandler('task:update')
  ipcMain.handle('task:update', async (_, id: string, changes) => api.updateTaskAction(id, changes))

  ipcMain.removeHandler('task:delete')
  ipcMain.handle('task:delete', async (_, id: string) => api.deleteTaskAction(id))

  // --- Engine handlers ---
  ipcMain.removeHandler('engine:status')
  ipcMain.handle('engine:status', async () => api.getEngineStatusAction())

  ipcMain.removeHandler('engine:start')
  ipcMain.handle('engine:start', async () => api.startEngineAction())

  ipcMain.removeHandler('engine:stop')
  ipcMain.handle('engine:stop', async () => api.stopEngineAction())

  ipcMain.removeHandler('engine:pause')
  ipcMain.handle('engine:pause', async () => api.pauseEngineAction())

  ipcMain.removeHandler('engine:resume')
  ipcMain.handle('engine:resume', async () => api.resumeEngineAction())

  ipcMain.removeHandler('engine:setConcurrency')
  ipcMain.handle('engine:setConcurrency', async (_, n: number) => api.setEngineConcurrencyAction(n))

  ipcMain.removeHandler('engine:listProviders')
  ipcMain.handle('engine:listProviders', async () => api.listEngineProvidersAction())

  ipcMain.removeHandler('engine:getProvider')
  ipcMain.handle('engine:getProvider', async () => api.getEngineProviderAction())

  ipcMain.removeHandler('engine:setProvider')
  ipcMain.handle('engine:setProvider', async (_, name: string) => api.setEngineProviderAction(name))

  // --- Dialog handlers ---
  ipcMain.removeHandler('dialog:openDirectory')
  ipcMain.handle('dialog:openDirectory', async () => {
    console.log('[ipc] dialog:openDirectory')
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (result.canceled) {
      console.log('[ipc] dialog:openDirectory canceled')
      return { ok: false }
    }
    console.log('[ipc] dialog:openDirectory ok', result.filePaths[0])
    return { ok: true, path: result.filePaths[0] }
  })
}
