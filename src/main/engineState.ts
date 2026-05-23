import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface EngineState {
  running: boolean
  concurrency?: number
  provider?: string
}

const STATE_FILE = join(app.getPath('userData'), 'engine-state.json')

export function loadEngineState(): EngineState {
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
      if (typeof data.running === 'boolean') {
        return {
          running: data.running,
          concurrency: typeof data.concurrency === 'number' ? data.concurrency : undefined,
          provider: typeof data.provider === 'string' ? data.provider : undefined,
        }
      }
    }
  } catch (err) {
    console.error('[engineState] load failed:', err)
  }
  return { running: true }
}

export function saveEngineState(state: EngineState): void {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('[engineState] save failed:', err)
  }
}
