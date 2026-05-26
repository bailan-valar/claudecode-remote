import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const CONFIG_DIR = app.getPath('userData')
const CONFIG_FILE = join(CONFIG_DIR, 'app-config.json')

export interface AppConfig {
  couchDbUrl: string
  couchDbUser?: string
  couchDbPassword?: string
  couchDbAdminUser?: string
  couchDbAdminPassword?: string
  webPort?: number
}

const DEFAULT_CONFIG: AppConfig = {
  couchDbUrl: 'http://localhost:5984',
  webPort: 3456,
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function saveConfig(config: Partial<AppConfig>): void {
  console.log('[config] saveConfig input:', config)
  ensureConfigDir()
  const existing = loadConfig()
  const merged = { ...existing, ...config }
  console.log('[config] merged config:', merged)
  console.log('[config] writing to:', CONFIG_FILE)
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 })
  console.log('[config] saved successfully', { couchDbUrl: merged.couchDbUrl, webPort: merged.webPort })
}

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) {
    console.log('[config] not found, using defaults')
    return { ...DEFAULT_CONFIG }
  }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(raw) as AppConfig
    console.log('[config] loaded', { couchDbUrl: config.couchDbUrl, webPort: config.webPort })
    return { ...DEFAULT_CONFIG, ...config }
  } catch (err: any) {
    console.error('[config] load failed:', err.message)
    return { ...DEFAULT_CONFIG }
  }
}

export function getConfig(): AppConfig {
  return loadConfig()
}

export function resetConfig(): void {
  const { unlinkSync } = require('fs')
  if (existsSync(CONFIG_FILE)) {
    try {
      unlinkSync(CONFIG_FILE)
      console.log('[config] reset to defaults')
    } catch (err: any) {
      console.error('[config] reset failed:', err.message)
    }
  }
}
