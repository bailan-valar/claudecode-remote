export const DOC_TYPE = {
  PROJECT: 'project' as const,
  TASK: 'task' as const,
}

export const TASK_STATUS = {
  PLANNED: 'planned',
  PENDING: 'pending',
  DEVELOPING: 'developing',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  CLOSED: 'closed',
} as const

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]
export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY]
