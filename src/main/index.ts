import 'dotenv/config'
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { SyncManager } from './db'
import { AuthManager } from './auth'
import { registerIpcHandlers } from './ipc'
import { TaskEngine } from './engine/taskEngine'
import { loadEngineState } from './engineState'
import { broadcast } from './events'
import { getSessionAction } from './apiActions'
import { getConfig, type AppConfig } from './configStore'

// 优先使用环境变量（开发时），否则使用配置文件（打包后）
const config = getConfig()
const couchBaseUrl =
  process.env.COUCHDB_URL?.replace(/\/[^/]*$/, '') ||
  config.couchDbUrl?.replace(/\/[^/]*$/, '') ||
  'http://localhost:5984'

let engine: TaskEngine | null = null

export function getEngine(): TaskEngine | null {
  return engine
}

export function setEngine(e: TaskEngine | null): void {
  engine = e
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && !input.alt && !input.control && !input.meta && !input.shift) {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export const syncManager = new SyncManager({
  baseUrl: couchBaseUrl,
  adminAuth:
    (process.env.COUCHDB_ADMIN_USER && process.env.COUCHDB_ADMIN_PASSWORD)
      ? {
          username: process.env.COUCHDB_ADMIN_USER,
          password: process.env.COUCHDB_ADMIN_PASSWORD,
        }
      : (config.couchDbAdminUser && config.couchDbAdminPassword)
        ? {
            username: config.couchDbAdminUser,
            password: config.couchDbAdminPassword,
          }
        : undefined,
})

syncManager.on('status', (status) => {
  broadcast('sync:status', status)
  if (status.phase === 'error') {
    console.error('[sync] error:', status.message)
  }
})

export const authManager = new AuthManager({
  baseUrl: couchBaseUrl,
  adminAuth:
    (process.env.COUCHDB_ADMIN_USER && process.env.COUCHDB_ADMIN_PASSWORD)
      ? {
          username: process.env.COUCHDB_ADMIN_USER,
          password: process.env.COUCHDB_ADMIN_PASSWORD,
        }
      : (config.couchDbAdminUser && config.couchDbAdminPassword)
        ? {
            username: config.couchDbAdminUser,
            password: config.couchDbAdminPassword,
          }
        : undefined,
})

app.whenReady().then(async () => {
  const win = createWindow()
  registerIpcHandlers(win)

  // 尝试从本地加密存储恢复登录态
  try {
    const sessionResult = await getSessionAction()
    if (sessionResult.user) {
      console.log('[main] auto-login restored:', sessionResult.user.username)
    }
  } catch (err: any) {
    console.error('[main] auto-login failed:', err.message)
  }

  // 启动 Web 服务器
  try {
    const { startWebServer } = await import('./webServer')
    startWebServer()
  } catch (err: any) {
    console.error('[main] failed to start web server:', err.message)
  }

  // 启动 HMR 热重载管理器
  try {
    const { getHMRManager } = await import('./utils/hmrManager')
    const hmrManager = getHMRManager()
    hmrManager.setMainWindow(win)

    // 只在开发环境下启动HMR
    if (process.env.NODE_ENV !== 'production') {
      hmrManager.start()
      console.log('[main] HMR manager started')
    }
  } catch (err: any) {
    console.error('[main] failed to start HMR manager:', err.message)
  }

  // 检查重启状态
  const { getRestartManager } = await import('./utils/restartManager')
  const restartManager = getRestartManager()

  const lastRestartState = restartManager.getLastRestartState()
  if (lastRestartState) {
    console.log('[main] Last restart state:', lastRestartState)
    broadcast('system:restarted', {
      reason: lastRestartState.reason,
      timestamp: lastRestartState.timestamp,
      taskIds: lastRestartState.taskIds
    })
    restartManager.clearRestartState()
  }

  // 启动任务引擎（若用户已登录且上次未手动停止）
  const db = syncManager.getLocalDb()
  if (db) {
    const state = loadEngineState()
    engine = new TaskEngine({ db, concurrency: state.concurrency ?? 1, provider: state.provider })
    engine.on('status', (status) => broadcast('engine:status', status))
    engine.on('task:completed', (taskId, result) => {
      broadcast('engine:task:completed', taskId, result)
      // 任务完成后触发重启逻辑
      console.log(`[main] Task ${taskId} completed, considering restart...`)

      // 检查任务结果，根据决定是否重启
      if (result.success) {
        restartManager.scheduleRestart(`Task ${taskId} completed successfully`, [taskId])
      }
    })
    engine.on('task:failed', (taskId, error) => broadcast('engine:task:failed', taskId, error))
    engine.on('task:logs_updated', (taskId, logs) => broadcast('engine:task:logs_updated', taskId, logs))
    setEngine(engine)
    if (state.running) {
      engine.start()
    }
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
