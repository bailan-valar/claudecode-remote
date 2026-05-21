import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: '规划中',
  pending: '待开发',
  developing: '开发中',
  reviewing: '待审核',
  completed: '已完成',
  closed: '已关闭',
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  planned: '#8e8e93',
  pending: '#007aff',
  developing: '#ff9f0a',
  reviewing: '#af52de',
  completed: '#34c759',
  closed: '#ff3b30',
}

// 当前状态 → 允许流转到的状态列表
export function getAllowedNext(status: TaskStatus): TaskStatus[] {
  switch (status) {
    case 'planned':
      return [TASK_STATUS.PENDING]
    case 'pending':
      return [TASK_STATUS.DEVELOPING]
    case 'developing':
      return [TASK_STATUS.REVIEWING]
    case 'reviewing':
      return [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING, TASK_STATUS.CLOSED]
    case 'completed':
      return []
    case 'closed':
      return []
  }
}

// 流转按钮的中文标签
export const TRANSITION_LABEL: Record<string, string> = {
  pending: '开始开发',
  developing: '提交审核',
  reviewing: '提交审核',
  completed: '完成',
  closed: '关闭',
}
