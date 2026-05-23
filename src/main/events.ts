import { EventEmitter } from 'node:events'

export const mainEvents = new EventEmitter()

export function broadcast(channel: string, ...args: any[]): void {
  mainEvents.emit(channel, ...args)
}
