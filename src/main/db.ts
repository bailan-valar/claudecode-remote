import PouchDB from 'pouchdb'
import { EventEmitter } from 'node:events'

export type SyncStatus =
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

export class SyncManager extends EventEmitter {
  private local: PouchDB.Database
  private remote: PouchDB.Database
  private handle?: PouchDB.Replication.Sync<{}>

  constructor(
    localPath: string,
    remoteUrl: string,
    auth?: { username: string; password: string },
  ) {
    super()
    this.local = new PouchDB(localPath)
    this.remote = new PouchDB(remoteUrl, auth ? { auth } : undefined)
  }

  start() {
    this.emit('status', { phase: 'connecting' })
    this.handle = this.local
      .sync(this.remote, { live: true, retry: true })
      .on('change', (info) =>
        this.emit('status', {
          phase: 'active',
          lastChange: info.change?.docs_read ?? 0,
        }),
      )
      .on('paused', () => this.emit('status', { phase: 'paused' }))
      .on('active', () => this.emit('status', { phase: 'active' }))
      .on('denied', (err) =>
        this.emit('status', {
          phase: 'error',
          message: `denied: ${(err as Error).message ?? String(err)}`,
        }),
      )
      .on('error', (err) =>
        this.emit('status', {
          phase: 'error',
          message: String(err),
        }),
      )
  }

  async restart() {
    this.handle?.cancel()
    this.start()
  }
}

const url = process.env.COUCHDB_URL || 'http://localhost:5984/cc-remote'
const auth =
  process.env.COUCHDB_USER && process.env.COUCHDB_PASSWORD
    ? {
        username: process.env.COUCHDB_USER,
        password: process.env.COUCHDB_PASSWORD,
      }
    : undefined

export const syncManager = new SyncManager('cc-remote-local', url, auth)
