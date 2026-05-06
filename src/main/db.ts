import PouchDB from 'pouchdb'
import { EventEmitter } from 'node:events'

export type SyncStatus =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

export interface SyncManagerOptions {
  baseUrl: string
  adminAuth?: { username: string; password: string }
}

export function getUserDbName(username: string): string {
  return 'userdb-' + Buffer.from(username).toString('hex')
}

export class SyncManager extends EventEmitter {
  private baseUrl: string
  private adminAuth?: { username: string; password: string }
  private local?: PouchDB.Database
  private remote?: PouchDB.Database
  private handle?: PouchDB.Replication.Sync<{}>
  private currentUsername?: string

  constructor(options: SyncManagerOptions) {
    super()
    this.baseUrl = options.baseUrl
    this.adminAuth = options.adminAuth
  }

  get currentUser(): string | undefined {
    return this.currentUsername
  }

  getLocalDb(): PouchDB.Database | undefined {
    return this.local
  }

  async switchToUser(username: string, password: string): Promise<void> {
    this.stop()

    const localName = `cc-remote-${username}`
    const remoteName = getUserDbName(username)

    this.local = new PouchDB(localName)
    this.remote = new PouchDB(`${this.baseUrl}/${remoteName}`, {
      auth: { username, password },
    })
    this.currentUsername = username

    // Ensure remote DB exists (couch_peruser auto-creates, but fallback just in case)
    try {
      await this.remote.info()
    } catch (err: any) {
      if (err.status === 404 && this.adminAuth) {
        const adminRemote = new PouchDB(`${this.baseUrl}/${remoteName}`, {
          auth: this.adminAuth,
        })
        await adminRemote.info() // PUT creates DB
      }
    }

    this.start()
  }

  logout(): void {
    this.stop()
    this.local = undefined
    this.remote = undefined
    this.currentUsername = undefined
    this.emit('status', { phase: 'idle' })
  }

  private start(): void {
    if (!this.local || !this.remote) return
    this.emit('status', { phase: 'connecting' })
    this.handle = this.local
      .sync(this.remote, { live: true, retry: true })
      .on('change', (info) => {
        const changeCount = info.change?.docs?.length ?? 0
        this.emit('status', { phase: 'active', lastChange: changeCount })
      })
      .on('paused', () => this.emit('status', { phase: 'paused' }))
      .on('active', () => this.emit('status', { phase: 'active' }))
      .on('denied', (err: any) =>
        this.emit('status', { phase: 'error', message: `denied: ${err.reason}` }),
      )
      .on('error', (err: any) =>
        this.emit('status', { phase: 'error', message: String(err.message || err) }),
      )
  }

  private stop(): void {
    this.handle?.cancel?.()
    this.handle = undefined
  }

  restart(): void {
    this.stop()
    this.start()
  }
}
