import { ipcMain, BrowserWindow, dialog } from 'electron'
import { syncManager } from './index'
import { authManager } from './index'
import { createProjectRepository } from './repositories/projectRepository'
import { createTaskRepository } from './repositories/taskRepository'

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
    try {
      await authManager.signUp(username, password)
      return { ok: true }
    } catch (err: any) {
      console.error('[auth] register failed:', err.message)
      return { ok: false, error: err.message || '注册失败' }
    }
  })

  ipcMain.removeHandler('auth:login')
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const user = await authManager.logIn(username, password)
      await syncManager.switchToUser(username, password)
      return { ok: true, user }
    } catch (err: any) {
      console.error('[auth] login failed:', err.message)
      return { ok: false, error: err.message || '登录失败' }
    }
  })

  ipcMain.removeHandler('auth:logout')
  ipcMain.handle('auth:logout', async () => {
    try {
      await authManager.logOut()
      syncManager.logout()
      return { ok: true }
    } catch (err: any) {
      console.error('[auth] logout failed:', err.message)
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
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    const projects = await repo.findAll()
    return { ok: true, projects }
  })

  ipcMain.removeHandler('project:create')
  ipcMain.handle('project:create', async (_, doc) => {
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
    return { ok: true, project }
  })

  ipcMain.removeHandler('project:update')
  ipcMain.handle('project:update', async (_, id: string, changes) => {
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    const project = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() })
    return { ok: true, project }
  })

  ipcMain.removeHandler('project:delete')
  ipcMain.handle('project:delete', async (_, id: string) => {
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createProjectRepository(db)
    await repo.delete(id)
    return { ok: true }
  })

  // --- Task CRUD handlers ---
  ipcMain.removeHandler('task:list')
  ipcMain.handle('task:list', async (_, projectId?: string) => {
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    let tasks = await repo.findAll()
    if (projectId) {
      tasks = tasks.filter((t) => t.projectId === projectId)
    }
    return { ok: true, tasks }
  })

  ipcMain.removeHandler('task:create')
  ipcMain.handle('task:create', async (_, doc) => {
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
    })
    return { ok: true, task }
  })

  ipcMain.removeHandler('task:update')
  ipcMain.handle('task:update', async (_, id: string, changes) => {
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    const task = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() })
    return { ok: true, task }
  })

  ipcMain.removeHandler('task:delete')
  ipcMain.handle('task:delete', async (_, id: string) => {
    const db = syncManager.getLocalDb()
    if (!db) return { ok: false, error: '未登录' }
    const repo = createTaskRepository(db)
    await repo.delete(id)
    return { ok: true }
  })

  // --- Dialog handlers ---
  ipcMain.removeHandler('dialog:openDirectory')
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (result.canceled) return { ok: false }
    return { ok: true, path: result.filePaths[0] }
  })
}
