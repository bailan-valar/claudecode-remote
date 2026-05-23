import PouchDB from 'pouchdb'
import PouchAuth from 'pouchdb-authentication'

PouchDB.plugin(PouchAuth)

export interface User {
  username: string
  roles: string[]
}

export interface AuthManagerOptions {
  baseUrl: string
  adminAuth?: { username: string; password: string }
}

export class AuthManager {
  private db: PouchDB.Database
  private adminDb?: PouchDB.Database
  private adminAuth?: { username: string; password: string }
  private baseUrl: string

  constructor(options: AuthManagerOptions) {
    this.baseUrl = options.baseUrl
    this.adminAuth = options.adminAuth
    this.db = new PouchDB(options.baseUrl)
    if (options.adminAuth) {
      this.adminDb = new PouchDB(options.baseUrl, {
        auth: options.adminAuth,
      })
    }
  }

  async signUp(username: string, password: string): Promise<void> {
    const target = this.adminDb || this.db
    const userDocId = `org.couchdb.user:${username}`

    // 若有 admin 权限，先检查用户是否已存在
    if (this.adminAuth) {
      try {
        const usersDb = new PouchDB(`${this.baseUrl}/_users`, {
          auth: this.adminAuth,
        })
        await usersDb.get(userDocId)
        console.log('[auth] signUp: user already exists', username)
        throw new Error('用户已存在')
      } catch (err: any) {
        if (err.status !== 404 && err.message !== '用户已存在') {
          console.warn('[auth] signUp: check existing user failed:', err.message)
        }
        if (err.message === '用户已存在') throw err
      }
    }

    try {
      await (target as any).signUp(username, password)
      console.log('[auth] signUp ok', username)
    } catch (err: any) {
      if (err.name === 'conflict' || err.status === 409) {
        console.error('[auth] signUp conflict', username)
        throw new Error('用户已存在')
      }
      console.error('[auth] signUp failed:', err.message)
      throw err
    }
  }

  async logIn(username: string, password: string): Promise<User> {
    console.log('[auth] logIn', username)
    const response = await (this.db as any).logIn(username, password)
    console.log('[auth] logIn ok', username)
    return { username: response.name, roles: response.roles }
  }

  async logOut(): Promise<void> {
    console.log('[auth] logOut')
    await (this.db as any).logOut()
    console.log('[auth] logOut ok')
  }

  async getSession(): Promise<User | null> {
    const response = await (this.db as any).getSession()
    if (response.userCtx?.name) {
      return { username: response.userCtx.name, roles: response.userCtx.roles }
    }
    return null
  }
}
