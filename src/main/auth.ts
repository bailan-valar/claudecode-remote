import PouchDB from 'pouchdb'
import PouchAuth from 'pouchdb-authentication'

PouchDB.plugin(PouchAuth)

export interface User {
  username: string
  roles: string[]
}

export class AuthManager {
  private db: PouchDB.Database

  constructor(baseUrl: string) {
    this.db = new PouchDB(baseUrl)
  }

  async signUp(username: string, password: string): Promise<void> {
    await (this.db as any).signUp(username, password)
  }

  async logIn(username: string, password: string): Promise<User> {
    const response = await (this.db as any).logIn(username, password)
    return { username: response.name, roles: response.roles }
  }

  async logOut(): Promise<void> {
    await (this.db as any).logOut()
  }

  async getSession(): Promise<User | null> {
    const response = await (this.db as any).getSession()
    if (response.userCtx?.name) {
      return { username: response.userCtx.name, roles: response.userCtx.roles }
    }
    return null
  }
}
