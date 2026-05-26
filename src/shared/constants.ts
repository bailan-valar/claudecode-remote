export const DOC_TYPE = {
  PROJECT: 'project' as const,
  TASK: 'task' as const,
}

export const TASK_STATUS = {
  PLANNED: 'planned',
  PLAN_REQUIRED: 'plan_required',
  PLANNING: 'planning',
  PLAN_REVIEWING: 'plan_reviewing',
  PENDING: 'pending',
  DEVELOPING: 'developing',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  STOPPED: 'stopped',
  FAILED: 'failed',
} as const

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

export const TASK_KIND = {
  EPIC: 'epic',
  REQUIREMENT: 'requirement',
  STORY: 'story',
  BUG: 'bug',
  TASK: 'task',
  CHAT: 'chat',
} as const

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS]
export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY]
export type TaskKind = (typeof TASK_KIND)[keyof typeof TASK_KIND]

export const KIND_LABEL: Record<TaskKind, string> = {
  epic: '史诗',
  requirement: '需求',
  story: '故事',
  bug: '缺陷',
  task: '任务',
  chat: '对话',
}

export const ENGINE_PROVIDER = {
  CLAUDE: 'claude',
  MOCK: 'mock',
} as const

export type EngineProvider = (typeof ENGINE_PROVIDER)[keyof typeof ENGINE_PROVIDER]
