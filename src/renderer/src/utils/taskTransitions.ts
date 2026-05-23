import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: '规划中',
  plan_required: '待明确计划',
  planning: '计划编写中',
  plan_reviewing: '计划待审核',
  pending: '待开发',
  developing: '开发中',
  reviewing: '待审核',
  completed: '已完成',
  closed: '已关闭',
  stopped: '已停止',
  failed: '执行失败',
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  planned: '#8e8e93',
  plan_required: '#5856d6',
  planning: '#ff9f0a',
  plan_reviewing: '#af52de',
  pending: '#007aff',
  developing: '#ff9f0a',
  reviewing: '#af52de',
  completed: '#34c759',
  closed: '#ff3b30',
  stopped: '#ff3b30',
  failed: '#ff3b30',
}

interface TaskLike {
  isPlan?: boolean
}

// 当前状态 → 允许流转到的状态列表
export function getAllowedNext(status: TaskStatus, task?: TaskLike): TaskStatus[] {
  switch (status) {
    case 'planned':
      return [TASK_STATUS.PLAN_REQUIRED, TASK_STATUS.PENDING]
    case 'plan_required':
      return [TASK_STATUS.PLANNING]
    case 'planning':
      return [TASK_STATUS.PLAN_REVIEWING, TASK_STATUS.STOPPED]
    case 'plan_reviewing':
      return [TASK_STATUS.PENDING, TASK_STATUS.CLOSED]
    case 'pending':
      return [TASK_STATUS.DEVELOPING]
    case 'developing':
      return [TASK_STATUS.REVIEWING, TASK_STATUS.STOPPED]
    case 'reviewing':
      return [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING, TASK_STATUS.CLOSED]
    case 'completed':
      return []
    case 'closed':
      return []
    case 'stopped':
      return task?.isPlan ? [TASK_STATUS.PLAN_REQUIRED] : [TASK_STATUS.PENDING]
    case 'failed':
      return task?.isPlan ? [TASK_STATUS.PLANNING, TASK_STATUS.CLOSED] : [TASK_STATUS.DEVELOPING, TASK_STATUS.CLOSED]
    default:
      return []
  }
}

// 流转按钮的中文标签
export const TRANSITION_LABEL: Record<string, string> = {
  plan_required: '开始明确计划',
  planning: '提交计划审核',
  plan_reviewing: '审核计划',
  pending: '开始开发',
  developing: '提交审核',
  reviewing: '提交审核',
  completed: '完成',
  closed: '关闭',
  stopped: '停止',
}
