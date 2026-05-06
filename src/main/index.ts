import 'dotenv/config'
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { SyncManager } from './db'
import { AuthManager } from './auth'
import { registerIpcHandlers } from './ipc'

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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

const couchBaseUrl =
  process.env.COUCHDB_URL?.replace(/\/[^/]*$/, '') || 'http://localhost:5984'

export const syncManager = new SyncManager({
  baseUrl: couchBaseUrl,
  adminAuth:
    process.env.COUCHDB_ADMIN_USER && process.env.COUCHDB_ADMIN_PASSWORD
      ? {
          username: process.env.COUCHDB_ADMIN_USER,
          password: process.env.COUCHDB_ADMIN_PASSWORD,
        }
      : undefined,
})

export const authManager = new AuthManager(couchBaseUrl)

app.whenReady().then(() => {
  const win = createWindow()
  registerIpcHandlers(win)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
