import 'dotenv/config'
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import PouchDB from 'pouchdb'
import { SyncManager } from './db'
import { registerIpcHandlers } from './ipc'
import { TaskEngine } from './engine/taskEngine'
import { loadEngineState } from './engineState'
import { broadcast } from './events'
import { getConfig, type AppConfig } from './configStore'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// 优先使用环境变量（开发时），否则使用配置文件（打包后）
const config = getConfig()
const couchBaseUrl =
  process.env.COUCHDB_URL?.replace(/\/[^/]*$/, '') ||
  config.couchDbUrl?.replace(/\/[^/]*$/, '') ||
  'http://localhost:5984'

// 获取/创建实例 ID
const INSTANCE_ID_FILE = join(app.getPath('userData'), 'instance-id.json')

interface InstanceId {
  id: string
  createdAt: string
}

function getInstanceId(): string {
  if (existsSync(INSTANCE_ID_FILE)) {
    try {
      const data = JSON.parse(readFileSync(INSTANCE_ID_FILE, 'utf-8')) as InstanceId
      return data.id
    } catch {
      // ignore
    }
  }
  // 生成新的实例ID
  const newInstance: InstanceId = {
    id: randomUUID(),
    createdAt: new Date().toISOString()
  }
  writeFileSync(INSTANCE_ID_FILE, JSON.stringify(newInstance, null, 2))
  return newInstance.id
}

function getLocalDbName(): string {
  const instanceId = getInstanceId()
  return `cc-remote-${instanceId.slice(0, 8)}`
}

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
    mainWindow.maximize()
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
  localDbPath: app.getPath('userData'),
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

// 自动初始化默认本地数据库
let defaultLocalDb: PouchDB.Database | null = null

export function getDefaultLocalDb(): PouchDB.Database | null {
  return defaultLocalDb
}

export function setDefaultLocalDb(db: PouchDB.Database | null): void {
  defaultLocalDb = db
}

app.whenReady().then(async () => {
  const win = createWindow()
  registerIpcHandlers(win)

  // 初始化默认本地数据库
  const localName = getLocalDbName()
  const localDbPath = join(app.getPath('userData'), localName)
  defaultLocalDb = new PouchDB(localDbPath)
  console.log('[main] default local db initialized:', localDbPath)

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

  // 启动任务引擎
  const state = loadEngineState()
  engine = new TaskEngine({ db: defaultLocalDb, concurrency: state.concurrency ?? 1, provider: state.provider })
  engine.on('status', (status) => broadcast('engine:status', status))
  engine.on('task:completed', (taskId, result) => {
    broadcast('engine:task:completed', taskId, result)
  })
  engine.on('task:failed', (taskId, error) => broadcast('engine:task:failed', taskId, error))
  engine.on('task:logs_updated', (taskId, logs) => broadcast('engine:task:logs_updated', taskId, logs))
  setEngine(engine)
  if (state.running) {
    engine.start()
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
