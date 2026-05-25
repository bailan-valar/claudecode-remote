import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface RestartConfig {
  enabled: boolean
  description: string
  restart: {
    autoRestartOnTaskComplete: boolean
    restartDelay: number
    maxRestartsPerHour: number
    restartReasons: {
      task_complete: string
      file_change: string
      manual: string
    }
  }
  watch: {
    enabled: boolean
    directories: string[]
    filePatterns: string[]
  }
  notifications: {
    enabled: boolean
    message: string
  }
  safeMode: {
    enabled: boolean
    description: string
  }
}

const DEFAULT_CONFIG: RestartConfig = {
  enabled: true,
  description: '默认重启配置',
  restart: {
    autoRestartOnTaskComplete: true,
    restartDelay: 3000,
    maxRestartsPerHour: 20,
    restartReasons: {
      task_complete: '任务完成后自动重启',
      file_change: '监控文件变化后重启',
      manual: '手动触发重启'
    }
  },
  watch: {
    enabled: true,
    directories: [],
    filePatterns: []
  },
  notifications: {
    enabled: true,
    message: '系统将在 {{delay}} 秒后重启以加载最新的更改...'
  },
  safeMode: {
    enabled: false,
    description: '安全模式下不会自动重启，只记录日志'
  }
}

let configCache: RestartConfig | null = null

export function getRestartConfig(): RestartConfig {
  if (configCache) {
    return configCache!
  }

  try {
    const configPath = join(process.cwd(), 'restart.config.json')
    
    if (existsSync(configPath)) {
      const configData = readFileSync(configPath, 'utf-8')
      const userConfig = JSON.parse(configData)
      
      // 合并用户配置和默认配置
      configCache = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        restart: {
          ...DEFAULT_CONFIG.restart,
          ...userConfig.restart
        },
        watch: {
          ...DEFAULT_CONFIG.watch,
          ...userConfig.watch
        },
        notifications: {
          ...DEFAULT_CONFIG.notifications,
          ...userConfig.notifications
        },
        safeMode: {
          ...DEFAULT_CONFIG.safeMode,
          ...userConfig.safeMode
        }
      }
    } else {
      configCache = DEFAULT_CONFIG
    }
  } catch (error) {
    console.error('[RestartConfig] Failed to load config, using defaults:', error)
    configCache = DEFAULT_CONFIG
  }

  return configCache!
}

export function shouldAutoRestart(): boolean {
  const config = getRestartConfig()
  return config.enabled && 
         config.restart.autoRestartOnTaskComplete && 
         !config.safeMode.enabled
}

export function getRestartDelay(): number {
  const config = getRestartConfig()
  return config.restart.restartDelay
}

export function formatNotificationMessage(delay: number): string {
  const config = getRestartConfig()
  return config.notifications.message.replace('{{delay}}', (delay / 1000).toString())
}

export function isSafeMode(): boolean {
  const config = getRestartConfig()
  return config.safeMode.enabled
}
