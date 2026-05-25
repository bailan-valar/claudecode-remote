import { watch, FSWatcher } from 'fs'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { broadcast } from '../events'

export interface HMRConfig {
  enabled: boolean
  autoRestart: boolean
  watchedPaths: string[]
  ignoredPaths: string[]
  debounceDelay: number
  changeThreshold: number
}

interface FileChangeEvent {
  path: string
  type: string
  timestamp: number
}

interface HMRStats {
  filesChanged: number
  lastChangeTime: number
  restartsTriggered: number
}

export class HMRManager {
  private config: HMRConfig
  private watchers: FSWatcher[] = []
  private changeQueue: FileChangeEvent[] = []
  private debounceTimer: NodeJS.Timeout | null = null
  private isReloading = false
  private mainWindow: BrowserWindow | null = null
  private stats: HMRStats = {
    filesChanged: 0,
    lastChangeTime: 0,
    restartsTriggered: 0
  }

  constructor(private projectRoot: string) {
    this.config = this.loadConfig()
    this.setupGlobalHandlers()
  }

  private loadConfig(): HMRConfig {
    try {
      const configPath = join(this.projectRoot, 'hmr.config.json')
      if (existsSync(configPath)) {
        const configData = JSON.parse(readFileSync(configPath, 'utf-8'))
        console.log('[HMR] Configuration loaded from hmr.config.json')
        return { ...this.getDefaultConfig(), ...configData }
      }
    } catch (error) {
      console.error('[HMR] Failed to load config, using defaults:', error)
    }

    return this.getDefaultConfig()
  }

  private getDefaultConfig(): HMRConfig {
    return {
      enabled: true,
      autoRestart: false, // 默认关闭自动重启，使用手动触发
      watchedPaths: [
        'src/main/**/*.ts',
        'src/preload/**/*.ts'
      ],
      ignoredPaths: [
        '**/node_modules/**',
        '**/out/**',
        '**/dist/**',
        '**/.git/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      debounceDelay: 1000,
      changeThreshold: 3
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public start(): void {
    if (!this.config.enabled) {
      console.log('[HMR] Hot Module Replacement is disabled')
      return
    }

    console.log('[HMR] Starting Hot Module Replacement...')
    console.log('[HMR] Auto restart:', this.config.autoRestart ? 'enabled' : 'disabled (manual)')

    // 监听精确路径而不是整个项目根目录
    for (const pattern of this.config.watchedPaths) {
      this.watchPattern(pattern)
    }

    console.log('[HMR] All watchers started successfully')
    broadcast('hmr:status', { enabled: true, running: true })
  }

  public stop(): void {
    console.log('[HMR] Stopping all watchers...')

    for (const watcher of this.watchers) {
      watcher.close()
    }

    this.watchers = []

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    broadcast('hmr:status', { enabled: true, running: false })
  }

  public isEnabled(): boolean {
    return this.config.enabled && this.watchers.length > 0
  }

  public getConfig(): HMRConfig {
    return { ...this.config }
  }

  public getStats(): HMRStats {
    return { ...this.stats }
  }

  public async manualReload(type: 'main' | 'renderer' | 'all' = 'main'): Promise<void> {
    console.log(`[HMR] Manual reload triggered: ${type}`)

    if (type === 'renderer' && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.reload()
      broadcast('hmr:notification', {
        type: 'renderer',
        message: '界面已重新加载'
      })
    } else if (type === 'main' || type === 'all') {
      const { getRestartManager } = await import('./restartManager.js')
      const manager = getRestartManager()
      await manager.immediateRestart('manual_hmr_trigger')
    }
  }

  private watchPattern(pattern: string): void {
    try {
      // 将 glob 模式转换为实际路径
      const watchPath = this.resolveWatchPath(pattern)
      if (!watchPath) return

      console.log(`[HMR] Watching: ${watchPath}`)

      const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        const filePath = join(watchPath, filename)

        if (this.shouldIgnoreFile(filePath)) return

        this.handleFileChange(filePath, eventType)
      })

      watcher.on('error', (error) => {
        console.error(`[HMR] Watcher error for ${pattern}:`, error)
      })

      this.watchers.push(watcher)

    } catch (error) {
      console.error(`[HMR] Failed to watch ${pattern}:`, error)
    }
  }

  private resolveWatchPath(pattern: string): string | null {
    // src/main/**/*.ts -> src/main
    // src/preload/**/*.ts -> src/preload
    const match = pattern.match(/^src\/[^\/]+/)
    return match ? join(this.projectRoot, match[0]) : null
  }

  private shouldIgnoreFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/')

    for (const pattern of this.config.ignoredPaths) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')

      try {
        const regex = new RegExp(regexPattern)
        if (regex.test(normalizedPath)) {
          return true
        }
      } catch (e) {
        // 忽略无效的正则表达式
      }
    }

    return false
  }

  private handleFileChange(filePath: string, type: string): void {
    console.log(`[HMR] File changed: ${filePath}`)

    this.changeQueue.push({
      path: filePath,
      type,
      timestamp: Date.now()
    })

    this.stats.filesChanged++
    this.stats.lastChangeTime = Date.now()

    broadcast('hmr:file-changed', {
      path: filePath,
      type,
      pendingChanges: this.changeQueue.length
    })

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.processChanges()
    }, this.config.debounceDelay)
  }

  private processChanges(): void {
    if (this.isReloading) {
      console.log('[HMR] Already processing changes, queuing')
      return
    }

    const changes = [...this.changeQueue]
    this.changeQueue = []

    if (changes.length === 0) return

    console.log(`[HMR] Processing ${changes.length} file changes`)

    if (this.config.autoRestart) {
      // 自动重启模式
      if (changes.length >= this.config.changeThreshold) {
        this.triggerRestart(changes.length)
      } else {
        broadcast('hmr:notification', {
          type: 'info',
          message: `${changes.length} 个文件已修改 (低于阈值 ${this.config.changeThreshold})`,
          changes: changes.length
        })
      }
    } else {
      // 手动模式 - 只通知不重启
      broadcast('hmr:notification', {
        type: 'pending',
        message: `${changes.length} 个文件已修改，请手动刷新`,
        changes: changes.length,
        files: changes.map(c => c.path)
      })
    }
  }

  private async triggerRestart(changeCount: number): Promise<void> {
    if (this.isReloading) return

    this.isReloading = true
    this.stats.restartsTriggered++

    console.log(`[HMR] Triggering restart: ${changeCount} files changed`)

    broadcast('hmr:notification', {
      type: 'restart',
      message: `主进程即将重启 (${changeCount} 个文件变更)`,
      changes: changeCount
    })

    try {
      const { getRestartManager } = await import('./restartManager.js')
      const manager = getRestartManager()
      await manager.immediateRestart('hmr_auto_restart')
    } catch (error) {
      console.error('[HMR] Failed to trigger restart:', error)
    } finally {
      this.isReloading = false
    }
  }

  private setupGlobalHandlers(): void {
    app.on('before-quit', () => {
      this.stop()
    })
  }
}

// 全局单例
let globalHMRManager: HMRManager | null = null

export function getHMRManager(): HMRManager {
  if (!globalHMRManager) {
    const projectRoot = process.cwd()
    globalHMRManager = new HMRManager(projectRoot)
  }
  return globalHMRManager
}

export function setHMRManager(manager: HMRManager): void {
  globalHMRManager = manager
}
