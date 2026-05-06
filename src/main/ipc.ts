import { ipcMain, BrowserWindow } from 'electron'
import { syncManager } from './db'

export function registerIpcHandlers(win: BrowserWindow) {
  ipcMain.removeHandler('sync:refresh')
  ipcMain.handle('sync:refresh', async () => {
    await syncManager.restart()
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
}
