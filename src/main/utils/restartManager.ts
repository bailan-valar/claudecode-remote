import { app } from 'electron'
import { spawn } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface RestartOptions {
  delay?: number // 延迟重启时间（毫秒）
  saveState?: boolean // 是否保存状态
  cleanupFn?: () => Promise<void> | void // 清理函数
}

export interface RestartState {
  reason: string
  timestamp: string
  taskIds?: string[]
}

const STATE_FILE = join(app.getPath('userData'), 'restart-state.json')

export class RestartManager {
  private restartTimer: NodeJS.Timeout | null = null
  private isRestarting = false

  constructor(private options: RestartOptions = {}) {
    // 默认配置
    this.options = {
      delay: 3000,
      saveState: true,
      ...options
    }
  }

  /**
   * 安排重启
   */
  scheduleRestart(reason: string, taskIds?: string[]): void {
    if (this.isRestarting) {
      console.log('[RestartManager] Already scheduled for restart')
      return
    }

    console.log(`[RestartManager] Scheduling restart: ${reason}`)

    // 清除已有的定时器
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
    }

    // 保存重启状态
    if (this.options.saveState) {
      this.saveRestartState(reason, taskIds)
    }

    // 安排延迟重启
    this.restartTimer = setTimeout(() => {
      this.executeRestart(reason)
    }, this.options.delay || 3000)

    this.isRestarting = true
  }

  /**
   * 立即重启
   */
  async immediateRestart(reason: string): Promise<void> {
    console.log(`[RestartManager] Immediate restart: ${reason}`)

    // 保存重启状态
    if (this.options.saveState) {
      this.saveRestartState(reason, [])
    }

    await this.executeRestart(reason)
  }

  /**
   * 取消重启
   */
  cancelRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
      this.isRestarting = false
      console.log('[RestartManager] Restart cancelled')
    }
  }

  /**
   * 检查是否有待处理的重启
   */
  isPendingRestart(): boolean {
    return this.isRestarting
  }

  /**
   * 获取上次的重启状态
   */
  getLastRestartState(): RestartState | null {
    try {
      if (existsSync(STATE_FILE)) {
        const content = readFileSync(STATE_FILE, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.error('[RestartManager] Failed to read restart state:', error)
    }
    return null
  }

  /**
   * 清除重启状态文件
   */
  clearRestartState(): void {
    try {
      if (existsSync(STATE_FILE)) {
        const fs = require('fs')
        fs.unlinkSync(STATE_FILE)
      }
    } catch (error) {
      console.error('[RestartManager] Failed to clear restart state:', error)
    }
  }

  private async executeRestart(reason: string): Promise<void> {
    try {
      console.log('[RestartManager] Executing restart...')

      // 执行清理函数
      if (this.options.cleanupFn) {
        try {
          await this.options.cleanupFn()
        } catch (error) {
          console.error('[RestartManager] Cleanup function failed:', error)
        }
      }

      // 延迟执行重启，确保清理完成
      setTimeout(() => {
        this.spawnNewProcess()
      }, 1000)

    } catch (error) {
      console.error('[RestartManager] Restart execution failed:', error)
      this.isRestarting = false
    }
  }

  private spawnNewProcess(): void {
    // 获取当前进程的执行命令
    const processArgs = process.argv.slice(1)
    const processCmd = process.execPath

    console.log('[RestartManager] Spawning new process:', processCmd, processArgs)

    try {
      // 启动新进程
      const child = spawn(processCmd, processArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development',
          ELECTRON_ENABLE_LOGGING: '1'
        },
        detached: true,
        stdio: 'ignore'
      })

      child.unref()

      console.log('[RestartManager] New process spawned with PID:', child.pid)

      // 退出当前进程
      console.log('[RestartManager] Exiting current process...')
      app.quit()
      process.exit(0)

    } catch (error) {
      console.error('[RestartManager] Failed to spawn new process:', error)
      this.isRestarting = false
    }
  }

  private saveRestartState(reason: string, taskIds?: string[]): void {
    try {
      const state: RestartState = {
        reason,
        timestamp: new Date().toISOString(),
        taskIds
      }
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
      console.log('[RestartManager] Restart state saved:', state)
    } catch (error) {
      console.error('[RestartManager] Failed to save restart state:', error)
    }
  }
}

// 创建全局实例
let globalRestartManager: RestartManager | null = null

export function getRestartManager(): RestartManager {
  if (!globalRestartManager) {
    globalRestartManager = new RestartManager({
      delay: 3000,
      saveState: true
    })
  }
  return globalRestartManager
}
