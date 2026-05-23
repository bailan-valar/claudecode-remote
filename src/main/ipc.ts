import { ipcMain, BrowserWindow, dialog } from 'electron'
import { syncManager, getEngine, setEngine } from './index'
import { authManager } from './index'
import { createProjectRepository } from './repositories/projectRepository'
import { createTaskRepository } from './repositories/taskRepository'
import { TaskEngine } from './engine/taskEngine'
import { loadEngineState, saveEngineState } from './engineState'
import { listRunners } from './engine/runnerRegistry'
import { computeTimeTrackingChanges } from './utils/taskTimeTracking'

export function registerIpcHandlers(win: BrowserWindow) {
  // --- Sync handlers ---
  ipcMain.removeHandler('sync:refresh')
  ipcMain.handle('sync:refresh', async () => {
    syncManager.restart()
    return { ok: true }
  })

  syncManager.on('status', (status) => {
    if (!win.isDestroyed()) {
      win.webContents.send('sync:status', status)
    }
    if (status.phase === 'error') {
      console.error('[sync] error:', status.message)
    }
  })

  // --- Auth handlers ---
  ipcMain.removeHandler('auth:register')
  ipcMain.handle('auth:register', async (_, username: string, password: string) => {
    console.log('[ipc] auth:register', username)
    try {
      await authManager.signUp(username, password)
      console.log('[ipc] auth:register ok')
      return { ok: true }
    } catch (err: any) {
      console.error('[ipc] auth:register failed:', err.message)
      return { ok: false, error: err.message || '注册失败' }
    }
  })

  ipcMain.removeHandler('auth:login')
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    console.log('[ipc] auth:login', username)
    try {
      const user = await authManager.logIn(username, password)
      await syncManager.switchToUser(username, password)
      // 启动引擎
      const db = syncManager.getLocalDb()
      if (db) {
        const oldEngine = getEngine()
        const provider = oldEngine?.getProvider?.() ?? loadEngineState().provider
        oldEngine?.stop?.()
        const engine = new TaskEngine({ db, concurrency: 1, provider })
        engine.on('status', (status) => {
          if (!win.isDestroyed()) {
            win.webContents.send('engine:status', status)
          }
        })
        engine.on('task:completed', (taskId, result) => {
          if (!win.isDestroyed()) {
            win.webContents.send('engine:task:completed', taskId, result)
          }
        })
        engine.on('task:failed', (taskId, error) => {
          if (!win.isDestroyed()) {
            win.webContents.send('engine:task:failed', taskId, error)
          }
        })
        setEngine(engine)
        const state = loadEngineState()
        if (state.running) {
          engine.start()
        }
      }
      console.log('[ipc] auth:login ok')
      return { ok: true, user }
    } catch (err: any) {
      console.error('[ipc] auth:login failed:', err.message)
      return { ok: false, error: err.message || '登录失败' }
    }
  })

  ipcMain.removeHandler('auth:logout')
  ipcMain.handle('auth:logout', async () => {
    console.log('[ipc] auth:logout')
    try {
      getEngine()?.stop?.()
      setEngine(null)
      await authManager.logOut()
      syncManager.logout()
      console.log('[ipc] auth:logout ok')
      return { ok: true }
    } catch (err: any) {
      console.error('[ipc] auth:logout failed:', err.message)
      return { ok: false, error: err.message || '注销失败' }
    }
  })

  ipcMain.removeHandler('auth:session')
  ipcMain.handle('auth:session', async () => {
    try {
      const user = await authManager.getSession()
      return { user }
    } catch (err: any) {
      console.error('[auth] getSession failed:', err.message)
      return { user: null }
    }
  })

  // --- Project CRUD handlers ---
  ipcMain.removeHandler('project:list')
  ipcMain.handle('project:list', async () => {
    console.log('[ipc] project:list')
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    const projects = await repo.findAll()
    console.log('[ipc] project:list ok, count=', projects.length)
    return { ok: true, projects }
  })

  ipcMain.removeHandler('project:create')
  ipcMain.handle('project:create', async (_, doc) => {
    console.log('[ipc] project:create', doc.name)
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
    console.log('[ipc] project:create ok', project._id)
    return { ok: true, project }
  })

  ipcMain.removeHandler('project:update')
  ipcMain.handle('project:update', async (_, id: string, changes) => {
    console.log('[ipc] project:update', id, changes)
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    const project = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() })
    console.log('[ipc] project:update ok', project._rev)
    return { ok: true, project }
  })

  ipcMain.removeHandler('project:delete')
  ipcMain.handle('project:delete', async (_, id: string) => {
    console.log('[ipc] project:delete', id)
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    await repo.delete(id)
    console.log('[ipc] project:delete ok')
    return { ok: true }
  })

  // --- Task CRUD handlers ---
  ipcMain.removeHandler('task:list')
  ipcMain.handle('task:list', async (_, projectId?: string) => {
    console.log('[ipc] task:list', projectId || '(all)')
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    let tasks = await repo.findAll()
    if (projectId) {
      tasks = tasks.filter((t) => t.projectId === projectId)
    }
    console.log('[ipc] task:list ok, count=', tasks.length)
    return { ok: true, tasks }
  })

  ipcMain.removeHandler('task:create')
  ipcMain.handle('task:create', async (_, doc) => {
    console.log('[ipc] task:create', doc.title)
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    const now = new Date().toISOString()
    const task = await repo.create({
      ...doc,
      type: 'task',
      status: doc.status || 'planned',
      priority: doc.priority || 'medium',
      logs: [],
      createdAt: now,
      updatedAt: now,
      createdVia: 'desktop',
      timeEntries: [],
      totalDuration: 0,
    })
    console.log('[ipc] task:create ok', task._id)
    return { ok: true, task }
  })

  ipcMain.removeHandler('task:update')
  ipcMain.handle('task:update', async (_, id: string, changes) => {
    console.log('[ipc] task:update', id, changes)
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)

    // 自动计时：状态流转时记录时间片
    let merged = { ...changes }
    if (changes.status) {
      const existing = await repo.findById(id)
      if (existing) {
        const timeChanges = computeTimeTrackingChanges(existing, changes.status)
        merged = { ...merged, ...timeChanges }
      }
    }

    const task = await repo.update(id, { ...merged, updatedAt: new Date().toISOString() })
    console.log('[ipc] task:update ok', task._rev)
    return { ok: true, task }
  })

  ipcMain.removeHandler('task:delete')
  ipcMain.handle('task:delete', async (_, id: string) => {
    console.log('[ipc] task:delete', id)
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    await repo.delete(id)
    console.log('[ipc] task:delete ok')
    return { ok: true }
  })

  // --- Engine handlers ---
  ipcMain.removeHandler('engine:status')
  ipcMain.handle('engine:status', async () => {
    const engine = getEngine()
    return { ok: true, status: engine?.getStatus() ?? { running: false, runningCount: 0, queueSize: 0, currentTaskIds: [] } }
  })

  ipcMain.removeHandler('engine:start')
  ipcMain.handle('engine:start', async () => {
    const engine = getEngine()
    if (engine) {
      engine.start()
      saveEngineState({ running: true, concurrency: engine.concurrency })
      return { ok: true }
    }
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const state = loadEngineState()
    const newEngine = new TaskEngine({ db, concurrency: state.concurrency ?? 1, provider: state.provider })
    newEngine.on('status', (status) => {
      if (!win.isDestroyed()) {
        win.webContents.send('engine:status', status)
      }
    })
    setEngine(newEngine)
    newEngine.start()
    saveEngineState({ running: true, concurrency: newEngine.concurrency })
    return { ok: true }
  })

  ipcMain.removeHandler('engine:stop')
  ipcMain.handle('engine:stop', async () => {
    const engine = getEngine()
    if (engine) {
      engine.stop()
      saveEngineState({ running: false, concurrency: engine.concurrency })
    }
    return { ok: true }
  })

  ipcMain.removeHandler('engine:pause')
  ipcMain.handle('engine:pause', async () => {
    getEngine()?.pause?.()
    return { ok: true }
  })

  ipcMain.removeHandler('engine:resume')
  ipcMain.handle('engine:resume', async () => {
    getEngine()?.resume?.()
    return { ok: true }
  })

  ipcMain.removeHandler('engine:setConcurrency')
  ipcMain.handle('engine:setConcurrency', async (_, n: number) => {
    const engine = getEngine()
    if (engine) {
      engine.setConcurrency(n)
      saveEngineState({ running: engine.running, concurrency: n, provider: engine.getProvider() })
    }
    return { ok: true }
  })

  ipcMain.removeHandler('engine:listProviders')
  ipcMain.handle('engine:listProviders', async () => {
    return { ok: true, providers: listRunners() }
  })

  ipcMain.removeHandler('engine:getProvider')
  ipcMain.handle('engine:getProvider', async () => {
    const engine = getEngine()
    return { ok: true, provider: engine?.getProvider?.() ?? loadEngineState().provider ?? 'anthropic' }
  })

  ipcMain.removeHandler('engine:setProvider')
  ipcMain.handle('engine:setProvider', async (_, name: string) => {
    const engine = getEngine()
    if (engine) {
      engine.setProvider(name)
      saveEngineState({ running: engine.running, concurrency: engine.concurrency, provider: name })
    } else {
      saveEngineState({ running: loadEngineState().running, concurrency: loadEngineState().concurrency, provider: name })
    }
    return { ok: true }
  })

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
