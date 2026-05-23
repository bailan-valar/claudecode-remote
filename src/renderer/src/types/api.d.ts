import type { Api } from '../../../preload/index.d.ts'

declare global {
  interface Window {
    api?: Api
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    keepAlive?: boolean
  }
}

export {}
