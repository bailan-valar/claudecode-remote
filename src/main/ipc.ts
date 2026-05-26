import { ipcMain, BrowserWindow, dialog } from 'electron'
import { syncManager } from './index'
import * as api from './apiActions'
import { mainEvents } from './events'
import type { LogEntry } from './engine/runner'
import * as configStore from './configStore'
import type { AppConfig } from './configStore'
import type { LlmProvider } from '../shared/types'

export function registerIpcHandlers(win: BrowserWindow) {
  // --- Broadcast to renderer window ---
  const sendToWin = (channel: string, ...args: any[]) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  // --- Config handlers ---
  ipcMain.removeHandler('config:get')
  ipcMain.handle('config:get', async () => {
    return { ok: true, config: configStore.getConfig() }
  })

  ipcMain.removeHandler('config:save')
  ipcMain.handle('config:save', async (_, config: Partial<AppConfig>) => {
    try {
      configStore.saveConfig(config)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.message || '保存配置失败' }
    }
  })

  ipcMain.removeHandler('config:reset')
  ipcMain.handle('config:reset', async () => {
    try {
      configStore.resetConfig()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.message || '重置配置失败' }
    }
  })

  ipcMain.removeHandler('config:test-couchdb')
  ipcMain.handle('config:test-couchdb', async (_, config: { url: string; adminUser?: string; adminPassword?: string }) => {
    return api.testCouchdbConnectionAction(config)
  })

  mainEvents.on('sync:status', (status) => sendToWin('sync:status', status))
  mainEvents.on('engine:status', (status) => sendToWin('engine:status', status))
  mainEvents.on('engine:task:completed', (taskId, result) => sendToWin('engine:task:completed', taskId, result))
  mainEvents.on('engine:task:failed', (taskId, error) => sendToWin('engine:task:failed', taskId, error))
  mainEvents.on('task:logs_updated', (taskId, logs) => sendToWin('engine:task:logs_updated', taskId, logs))
  mainEvents.on('task:created', (task) => sendToWin('task:created', task))
  mainEvents.on('task:updated', (task) => sendToWin('task:updated', task))
  mainEvents.on('task:deleted', (id) => sendToWin('task:deleted', id))
  mainEvents.on('project:created', (project) => sendToWin('project:created', project))
  mainEvents.on('project:updated', (project) => sendToWin('project:updated', project))
  mainEvents.on('project:deleted', (id) => sendToWin('project:deleted', id))
  mainEvents.on('claude:chat:log', (entry: LogEntry) => sendToWin('claude:chat:log', entry))
  mainEvents.on('claude:chat:done', (result: any) => sendToWin('claude:chat:done', result))

  // --- Sync handlers ---
  ipcMain.removeHandler('sync:refresh')
  ipcMain.handle('sync:refresh', async () => {
    syncManager.restart()
    return { ok: true }
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

  ipcMain.removeHandler('task:stop')
  ipcMain.handle('task:stop', async (_, id: string) => api.stopTaskAction(id))

  ipcMain.removeHandler('task:addLog')
  ipcMain.handle('task:addLog', async (_, id: string, message: string) => api.addTaskLogAction(id, message))

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

  // --- Data Export/Import handlers ---
  ipcMain.removeHandler('data:export')
  ipcMain.handle('data:export', async () => {
    return api.exportDataAction()
  })

  ipcMain.removeHandler('data:import')
  ipcMain.handle('data:import', async (_, data: any, options?: any) => {
    return api.importDataAction(data, options)
  })

  // --- Instance Info handler ---
  ipcMain.removeHandler('instance:info')
  ipcMain.handle('instance:info', async () => {
    return api.getInstanceInfoAction()
  })

  // --- LLM Providers handlers ---
  ipcMain.removeHandler('llm:providers:list')
  ipcMain.handle('llm:providers:list', async () => {
    try {
      const providers = configStore.loadLlmProviders()
      return { ok: true, providers }
    } catch (err: any) {
      return { ok: false, error: err.message || '加载 Provider 列表失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:get')
  ipcMain.handle('llm:providers:get', async (_, id: string) => {
    try {
      const provider = configStore.getLlmProvider(id)
      if (!provider) {
        return { ok: false, error: 'Provider 不存在' }
      }
      return { ok: true, provider }
    } catch (err: any) {
      return { ok: false, error: err.message || '获取 Provider 失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:getDefault')
  ipcMain.handle('llm:providers:getDefault', async () => {
    try {
      const provider = configStore.getDefaultLlmProvider()
      if (!provider) {
        return { ok: false, error: '没有可用的 Provider' }
      }
      return { ok: true, provider }
    } catch (err: any) {
      return { ok: false, error: err.message || '获取默认 Provider 失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:add')
  ipcMain.handle('llm:providers:add', async (_, provider: Omit<LlmProvider, 'id' | 'createdAt'>) => {
    try {
      const newProvider = configStore.addLlmProvider(provider)
      return { ok: true, provider: newProvider }
    } catch (err: any) {
      return { ok: false, error: err.message || '添加 Provider 失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:update')
  ipcMain.handle('llm:providers:update', async (_, id: string, updates: Partial<Omit<LlmProvider, 'id' | 'createdAt'>>) => {
    try {
      const updated = configStore.updateLlmProvider(id, updates)
      if (!updated) {
        return { ok: false, error: 'Provider 不存在' }
      }
      return { ok: true, provider: updated }
    } catch (err: any) {
      return { ok: false, error: err.message || '更新 Provider 失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:delete')
  ipcMain.handle('llm:providers:delete', async (_, id: string) => {
    try {
      const success = configStore.deleteLlmProvider(id)
      if (!success) {
        return { ok: false, error: 'Provider 不存在' }
      }
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.message || '删除 Provider 失败' }
    }
  })

  ipcMain.removeHandler('llm:providers:setDefault')
  ipcMain.handle('llm:providers:setDefault', async (_, id: string) => {
    try {
      const updated = configStore.updateLlmProvider(id, { isDefault: true })
      if (!updated) {
        return { ok: false, error: 'Provider 不存在' }
      }
      return { ok: true, provider: updated }
    } catch (err: any) {
      return { ok: false, error: err.message || '设置默认 Provider 失败' }
    }
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
