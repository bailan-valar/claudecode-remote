import 'pouchdb'

declare module 'pouchdb' {
  interface Database {
    signUp(username: string, password: string, opts?: object): Promise<any>
    logIn(username: string, password: string): Promise<any>
    logOut(): Promise<any>
    getSession(): Promise<any>
  }
}
