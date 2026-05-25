import { ipcMain, BrowserWindow, dialog } from 'electron'
import { syncManager } from './index'
import * as api from './apiActions'
import { mainEvents } from './events'
import type { LogEntry } from './engine/runner'

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
  mainEvents.on('claude:chat:log', (entry: LogEntry) => sendToWin('claude:chat:log', entry))
  mainEvents.on('claude:chat:done', (result: any) => sendToWin('claude:chat:done', result))

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

  ipcMain.removeHandler('task:resume')
  ipcMain.handle('task:resume', async (_, id: string) => api.resumeTaskAction(id))

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

  // --- Claude Chat handlers ---
  ipcMain.removeHandler('claude:chat')
  ipcMain.handle('claude:chat', async (_, projectId: string, message: string, sessionId?: string) => {
    return api.chatWithClaudeAction(projectId, message, sessionId)
  })

  ipcMain.removeHandler('claude:chat:abort')
  ipcMain.handle('claude:chat:abort', async () => {
    api.abortClaudeChatAction()
    return { ok: true }
  })

  ipcMain.removeHandler('claude:history')
  ipcMain.handle('claude:history', async (_, projectId: string) => {
    return api.getChatHistoryAction(projectId)
  })

  ipcMain.removeHandler('claude:messages:save')
  ipcMain.handle('claude:messages:save', async (_, message) => {
    return api.saveChatMessageAction(message)
  })

  ipcMain.removeHandler('claude:history:clear')
  ipcMain.handle('claude:history:clear', async (_, projectId: string) => {
    return api.clearChatHistoryAction(projectId)
  })

  // --- Webhook handlers ---
  ipcMain.removeHandler('webhook:test')
  ipcMain.handle('webhook:test', async (_, webhookUrl: string) => api.testWebhookAction(webhookUrl))

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

  // --- Terminal handlers ---
  ipcMain.removeHandler('terminal:execute')
  ipcMain.handle('terminal:execute', async (_, projectId: string, command: string, workingDir?: string) => {
    return api.executeTerminalCommandAction(projectId, command, workingDir)
  })

  // --- System restart handlers ---
  ipcMain.removeHandler('system:restart')
  ipcMain.handle('system:restart', async (_, options: { reason: string; delay?: number }) => {
    const { getRestartManager } = await import('./utils/restartManager')
    const manager = getRestartManager()

    if (options.delay) {
      setTimeout(() => {
        manager.immediateRestart(options.reason)
      }, options.delay)
    } else {
      await manager.immediateRestart(options.reason)
    }

    return { ok: true }
  })

  ipcMain.removeHandler('system:restart:cancel')
  ipcMain.handle('system:restart:cancel', async () => {
    const { getRestartManager } = await import('./utils/restartManager')
    const manager = getRestartManager()
    manager.cancelRestart()

    return { ok: true }
  })

  ipcMain.removeHandler('system:restart:status')
  ipcMain.handle('system:restart:status', async () => {
    const { getRestartManager } = await import('./utils/restartManager')
    const manager = getRestartManager()

    return {
      ok: true,
      isPendingRestart: manager.isPendingRestart(),
      lastRestartState: manager.getLastRestartState()
    }
  })

  // --- HMR handlers ---
  ipcMain.removeHandler('hmr:status')
  ipcMain.handle('hmr:status', async () => {
    const { getHMRManager } = await import('./utils/hmrManager')
    const hmrManager = getHMRManager()

    return {
      ok: true,
      stats: hmrManager.getStats(),
      config: hmrManager.getConfig(),
      isRunning: hmrManager.isEnabled()
    }
  })

  ipcMain.removeHandler('hmr:start')
  ipcMain.handle('hmr:start', async () => {
    const { getHMRManager } = await import('./utils/hmrManager')
    const hmrManager = getHMRManager()

    if (!hmrManager.isEnabled()) {
      hmrManager.start()
    }

    return { ok: true, enabled: hmrManager.isEnabled() }
  })

  ipcMain.removeHandler('hmr:stop')
  ipcMain.handle('hmr:stop', async () => {
    const { getHMRManager } = await import('./utils/hmrManager')
    const hmrManager = getHMRManager()

    if (hmrManager.isEnabled()) {
      hmrManager.stop()
    }

    return { ok: true }
  })

  ipcMain.removeHandler('hmr:reload')
  ipcMain.handle('hmr:reload', async (_, type: 'main' | 'renderer' | 'all') => {
    const { getHMRManager } = await import('./utils/hmrManager')
    await getHMRManager().manualReload(type)

    return { ok: true, message: `Reload triggered for ${type}` }
  })
}
