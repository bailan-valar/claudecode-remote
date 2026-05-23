import type { Task } from '../../../shared/types'

export function isTracking(task: Task): boolean {
  if (!task.timeEntries?.length) return false
  const last = task.timeEntries[task.timeEntries.length - 1]
  return !last.endedAt
}

export function getCurrentSessionStart(task: Task): string | null {
  if (!isTracking(task)) return null
  const last = task.timeEntries![task.timeEntries!.length - 1]
  return last.startedAt
}

export function calculateLiveDuration(task: Task): number {
  const base = task.totalDuration ?? 0
  if (!isTracking(task)) return base
  const start = getCurrentSessionStart(task)
  if (!start) return base
  const elapsed = Math.floor((Date.now() - new Date(start).getTime()) / 1000)
  return base + elapsed
}
