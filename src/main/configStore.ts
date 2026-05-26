import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { LlmProvider } from '../shared/types'

const CONFIG_DIR = app.getPath('userData')
const CONFIG_FILE = join(CONFIG_DIR, 'app-config.json')
const PROVIDERS_FILE = join(CONFIG_DIR, 'llm-providers.json')

export interface AppConfig {
  couchDbUrl: string
  couchDbUser?: string
  couchDbAdminUser?: string
  couchDbAdminPassword?: string
  webPort?: number
  defaultLlmProviderId?: string
}

const DEFAULT_CONFIG: AppConfig = {
  couchDbUrl: 'http://localhost:5984',
  webPort: 3456,
}

const DEFAULT_PROVIDERS: LlmProvider[] = [
  {
    id: 'anthropic-default',
    name: 'Anthropic 官方',
    type: 'anthropic',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
]

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

// === LLM Providers 管理 ===

function ensureProvidersFile(): void {
  if (!existsSync(PROVIDERS_FILE)) {
    writeFileSync(PROVIDERS_FILE, JSON.stringify(DEFAULT_PROVIDERS, null, 2), { mode: 0o600 })
    console.log('[providers] initialized with defaults')
  }
}

export function loadLlmProviders(): LlmProvider[] {
  ensureConfigDir()
  if (!existsSync(PROVIDERS_FILE)) {
    ensureProvidersFile()
    return [...DEFAULT_PROVIDERS]
  }
  try {
    const raw = readFileSync(PROVIDERS_FILE, 'utf8')
    const providers = JSON.parse(raw) as LlmProvider[]
    console.log('[providers] loaded', providers.length, 'providers')
    return providers
  } catch (err: any) {
    console.error('[providers] load failed:', err.message)
    return [...DEFAULT_PROVIDERS]
  }
}

export function saveLlmProviders(providers: LlmProvider[]): void {
  ensureConfigDir()
  writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), { mode: 0o600 })
  console.log('[providers] saved', providers.length, 'providers')
}

export function getLlmProvider(id: string): LlmProvider | null {
  const providers = loadLlmProviders()
  return providers.find(p => p.id === id) ?? null
}

export function getDefaultLlmProvider(): LlmProvider | null {
  const config = loadConfig()
  const providers = loadLlmProviders()

  // 优先使用配置中的默认
  if (config.defaultLlmProviderId) {
    const provider = providers.find(p => p.id === config.defaultLlmProviderId)
    if (provider) return provider
  }

  // 否则使用标记为默认的
  const defaultProvider = providers.find(p => p.isDefault)
  if (defaultProvider) return defaultProvider

  // 最后返回第一个
  return providers[0] ?? null
}

export function addLlmProvider(provider: Omit<LlmProvider, 'id' | 'createdAt'>): LlmProvider {
  // 输入验证
  if (!provider.name || provider.name.length > 100) {
    throw new Error('Provider 名称必须在 1-100 字符之间')
  }
  if (provider.type !== 'anthropic') {
    throw new Error('当前仅支持 anthropic (Claude Code) 类型')
  }
  if (provider.baseUrl && provider.baseUrl.length > 500) {
    throw new Error('Base URL 过长')
  }
  if (provider.apiKey && provider.apiKey.length > 500) {
    throw new Error('API Key 过长')
  }
  if (provider.model && provider.model.length > 100) {
    throw new Error('模型名称过长')
  }

  const providers = loadLlmProviders()
  const newProvider: LlmProvider = {
    ...provider,
    id: `llm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  providers.push(newProvider)

  // 如果这是第一个 provider 或者标记为默认，更新默认
  if (provider.isDefault || providers.length === 1) {
    providers.forEach(p => p.isDefault = (p.id === newProvider.id))
    const config = loadConfig()
    config.defaultLlmProviderId = newProvider.id
    saveConfig(config)
  }

  saveLlmProviders(providers)
  return newProvider
}

export function updateLlmProvider(id: string, updates: Partial<Omit<LlmProvider, 'id' | 'createdAt'>>): LlmProvider | null {
  const providers = loadLlmProviders()
  const index = providers.findIndex(p => p.id === id)
  if (index === -1) return null

  // 输入验证
  if (updates.name !== undefined && (updates.name.length === 0 || updates.name.length > 100)) {
    throw new Error('Provider 名称必须在 1-100 字符之间')
  }
  if (updates.type !== undefined && updates.type !== 'anthropic') {
    throw new Error('当前仅支持 anthropic (Claude Code) 类型')
  }
  if (updates.baseUrl && updates.baseUrl.length > 500) {
    throw new Error('Base URL 过长')
  }
  if (updates.apiKey && updates.apiKey.length > 500) {
    throw new Error('API Key 过长')
  }
  if (updates.model && updates.model.length > 100) {
    throw new Error('模型名称过长')
  }

  const updated = { ...providers[index], ...updates }
  providers[index] = updated

  // 如果设置为默认，更新其他 provider
  if (updates.isDefault) {
    providers.forEach(p => p.isDefault = (p.id === id))
    const config = loadConfig()
    config.defaultLlmProviderId = id
    saveConfig(config)
  }

  saveLlmProviders(providers)
  return updated
}

export function deleteLlmProvider(id: string): boolean {
  const providers = loadLlmProviders()
  const index = providers.findIndex(p => p.id === id)
  if (index === -1) return false

  const wasDefault = providers[index].isDefault
  providers.splice(index, 1)

  // 如果删除的是默认 provider，设置第一个为默认
  if (wasDefault && providers.length > 0) {
    providers[0].isDefault = true
    const config = loadConfig()
    config.defaultLlmProviderId = providers[0].id
    saveConfig(config)
  }

  saveLlmProviders(providers)
  return true
}
