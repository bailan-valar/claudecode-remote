import { safeStorage, app } from 'electron'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

const CREDENTIALS_FILE = join(app.getPath('userData'), 'auth-credentials.json')

interface StoredCredentials {
  username: string
  encryptedPassword: string // base64 encoded encrypted buffer
}

export function saveCredentials(username: string, password: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[credentials] encryption not available, skipping save')
      return
    }
    const encrypted = safeStorage.encryptString(password)
    const data: StoredCredentials = {
      username,
      encryptedPassword: encrypted.toString('base64'),
    }
    writeFileSync(CREDENTIALS_FILE, JSON.stringify(data), { mode: 0o600 })
    console.log('[credentials] saved for', username)
  } catch (err: any) {
    console.error('[credentials] save failed:', err.message)
    throw err
  }
}

export function loadCredentials(): { username: string; password: string } | null {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[credentials] encryption not available, skipping load')
    return null
  }
  if (!existsSync(CREDENTIALS_FILE)) return null
  try {
    const raw = readFileSync(CREDENTIALS_FILE, 'utf-8')
    const data: StoredCredentials = JSON.parse(raw)
    const encryptedBuffer = Buffer.from(data.encryptedPassword, 'base64')
    const password = safeStorage.decryptString(encryptedBuffer)
    return { username: data.username, password }
  } catch (err: any) {
    console.error('[credentials] load failed:', err.message)
    try {
      unlinkSync(CREDENTIALS_FILE)
    } catch {}
    return null
  }
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    try {
      unlinkSync(CREDENTIALS_FILE)
      console.log('[credentials] cleared')
    } catch (err: any) {
      console.error('[credentials] clear failed:', err.message)
    }
  }
}
