import type { Project, Task } from '../../shared/types'

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface RunResult {
  success: boolean
  result?: string
  sessionId?: string
  error?: string
}

export interface RunOptions {
  onLog?: (entry: LogEntry) => void
  abortSignal?: AbortSignal
}

export interface TaskRunner {
  readonly name: string
  runTask(task: Task, project: Project, options?: RunOptions): Promise<RunResult>
}
