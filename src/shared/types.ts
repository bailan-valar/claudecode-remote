import type { TaskStatus, TaskPriority, TaskKind } from './constants'

export interface BaseDoc {
  _id: string
  _rev: string
  type: string
}

export interface Project extends BaseDoc {
  type: 'project'
  name: string
  path: string
  description?: string
  llmConfig?: {
    provider: 'anthropic' | 'zhipu' | 'kimi'
    baseUrl?: string
    apiKey?: string
    model?: string
  }
  allowedTools?: string[]
  webhookUrl?: string
  webhookEnabled?: boolean
  webhookNotifyOnFailure?: boolean
  webhookMentionedList?: string[]
  siteUrl?: string
  createdAt: string
  updatedAt: string
}

export interface StatusHistoryEntry {
  status: TaskStatus
  startedAt: string
  endedAt?: string
  result?: string
}

export interface Task extends BaseDoc {
  type: 'task'
  projectId: string
  parentTaskId?: string | null
  title: string
  description?: string
  prompt?: string
  status: TaskStatus
  priority: TaskPriority
  kind: TaskKind
  isPlan?: boolean
  planOutput?: string
  claudeSessionId?: string | null
  logs: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error'
    message: string
  }>
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  createdVia: 'desktop' | 'mobile'
  reviewFeedback?: string
  timeEntries?: Array<{
    status?: TaskStatus
    startedAt: string
    endedAt?: string
  }>
  totalDuration?: number
  statusHistory?: StatusHistoryEntry[]
  result?: string
}

export interface User {
  username: string
  roles: string[]
}
