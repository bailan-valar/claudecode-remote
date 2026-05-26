import PouchDB from 'pouchdb'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'

export type SyncStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

export interface SyncManagerOptions {
  baseUrl: string
  adminAuth?: { username: string; password: string }
  localDbPath?: string
}

export function getUserDbName(username: string): string {
  return 'userdb-' + Buffer.from(username).toString('hex')
}

export class SyncManager extends EventEmitter {
  private baseUrl: string
  private adminAuth?: { username: string; password: string }
  private localDbPath?: string
  private local?: PouchDB.Database
  private remote?: PouchDB.Database
  private handle?: PouchDB.Replication.Sync<{}>
  private currentUsername?: string

  constructor(options: SyncManagerOptions) {
    super()
    this.baseUrl = options.baseUrl
    this.adminAuth = options.adminAuth
    this.localDbPath = options.localDbPath
  }

  get currentUser(): string | undefined {
    return this.currentUsername
  }

  getLocalDb(): PouchDB.Database | undefined {
    return this.local
  }

  async switchToUser(username: string, password: string): Promise<void> {
    console.log('[db] switchToUser', username)
    this.stop()

    const localName = this.localDbPath
      ? join(this.localDbPath, `cc-remote-${username}`)
      : `cc-remote-${username}`
    const remoteName = getUserDbName(username)

    this.local = new PouchDB(localName)
    this.remote = new PouchDB(`${this.baseUrl}/${remoteName}`, {
      auth: { username, password },
    })
    this.currentUsername = username

    // Ensure remote DB exists (couch_peruser auto-creates, but fallback just in case)
    try {
      const info = await this.remote.info()
      console.log('[db] remote info', info.db_name)
    } catch (err: any) {
      console.warn('[db] remote info failed:', err.status, err.message)
      // CouchDB 对不存在的数据库可能返回 401（隐藏 404），因此无论状态码都尝试用 admin 兜底创建
      if (this.adminAuth) {
        const createUrl = `${this.baseUrl}/${remoteName}`
        const auth = Buffer.from(`${this.adminAuth.username}:${this.adminAuth.password}`).toString('base64')
        try {
          const res = await fetch(createUrl, {
            method: 'PUT',
            headers: { Authorization: `Basic ${auth}` },
          })
          if (res.ok || res.status === 412) {
            console.log('[db] ensured remote DB exists')
          } else {
            console.error('[db] ensure remote DB failed:', res.status, await res.text().catch(() => ''))
          }
        } catch (fetchErr: any) {
          console.error('[db] ensure remote DB fetch failed:', fetchErr.message)
        }
      }
    }

    // Ensure user has access to their own remote DB (needed when admin creates it)
    if (this.adminAuth) {
      const securityUrl = `${this.baseUrl}/${remoteName}/_security`
      const auth = Buffer.from(`${this.adminAuth.username}:${this.adminAuth.password}`).toString('base64')
      try {
        const res = await fetch(securityUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            admins: { names: [], roles: [] },
            members: { names: [username], roles: [] },
          }),
        })
        if (res.ok) {
          console.log('[db] set security for', username)
        } else {
          console.warn('[db] set security failed:', res.status, await res.text().catch(() => ''))
        }
      } catch (secErr: any) {
        console.warn('[db] set security fetch failed:', secErr.message)
      }
    }

    this.start()
  }

  logout(): void {
    console.log('[db] logout')
    this.stop()
    this.local = undefined
    this.remote = undefined
    this.currentUsername = undefined
    this.emit('status', { phase: 'idle' })
  }

  private start(): void {
    if (!this.local || !this.remote) return
    console.log('[db] sync start')
    this.emit('status', { phase: 'connecting' })
    this.handle = this.local
      .sync(this.remote, { live: true, retry: true })
      .on('change', (info) => {
        const changeCount = info.change?.docs?.length ?? 0
        console.log('[db] sync change', changeCount, 'docs')
        this.emit('status', { phase: 'active', lastChange: changeCount })
      })
      .on('paused', () => {
        console.log('[db] sync paused')
        this.emit('status', { phase: 'paused' })
      })
      .on('active', () => {
        console.log('[db] sync active')
        this.emit('status', { phase: 'active' })
      })
      .on('denied', (err: any) => {
        console.error('[db] sync denied:', err)
        this.emit('status', { phase: 'error', message: `denied: ${err.reason}` })
      })
      .on('error', (err: any) => {
        console.error('[db] sync error:', err)
        this.emit('status', { phase: 'error', message: String(err.message || err) })
      })
  }

  private stop(): void {
    console.log('[db] sync stop')
    this.handle?.cancel?.()
    this.handle = undefined
  }

  restart(): void {
    console.log('[db] sync restart')
    this.stop()
    this.start()
  }
}
