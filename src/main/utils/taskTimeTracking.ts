import type { Task, StatusHistoryEntry } from '../../shared/types'
import { TASK_STATUS, type TaskStatus } from '../../shared/constants'

export interface TimeEntry {
  status?: TaskStatus
  startedAt: string
  endedAt?: string
}

export function computeTimeTrackingChanges(
  task: Task,
  newStatus: TaskStatus,
): Partial<Task> {
  if (task.status === newStatus) {
    return {}
  }

  const now = new Date().toISOString()
  const entries: TimeEntry[] = [...(task.timeEntries ?? [])]
  const history: StatusHistoryEntry[] = [...(task.statusHistory ?? [])]
  const changes: Partial<Task> = {}

  const lastEntry = entries[entries.length - 1]
  const isCurrentlyTracking = !!lastEntry && !lastEntry.endedAt

  const TRACKING_STATUSES: TaskStatus[] = [TASK_STATUS.DEVELOPING, TASK_STATUS.PLANNING]

  // 离开 tracking 状态：结束当前计时
  if (isCurrentlyTracking && !TRACKING_STATUSES.includes(newStatus)) {
    lastEntry.endedAt = now
    changes.timeEntries = entries
    changes.totalDuration = calculateTotalSeconds(entries)
  }

  // 进入 tracking 状态：开始新计时（如果当前没有在计时）
  if (TRACKING_STATUSES.includes(newStatus) && !isCurrentlyTracking) {
    entries.push({ startedAt: now, status: newStatus })
    changes.timeEntries = entries
  }

  // 维护 statusHistory：关闭上一个区间，开启新区间
  const lastHistory = history[history.length - 1]
  if (lastHistory && !lastHistory.endedAt) {
    lastHistory.endedAt = now
  }
  history.push({ status: newStatus, startedAt: now })
  changes.statusHistory = history

  return changes
}

export function calculateTotalSeconds(entries: TimeEntry[]): number {
  let ms = 0
  for (const e of entries) {
    const start = new Date(e.startedAt).getTime()
    const end = e.endedAt ? new Date(e.endedAt).getTime() : Date.now()
    ms += end - start
  }
  return Math.floor(ms / 1000)
}
