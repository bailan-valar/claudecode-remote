import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '../api'
import type { Task } from '../../../shared/types'
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const currentProjectId = ref<string | null>(null)

  const filteredTasks = computed(() => {
    if (!currentProjectId.value) return tasks.value
    return tasks.value.filter((t) => t.projectId === currentProjectId.value)
  })

  const stats = computed(() => {
    const counts = {} as Record<TaskStatus, number>
    Object.values(TASK_STATUS).forEach((s) => {
      counts[s] = 0
    })
    tasks.value.forEach((t) => {
      counts[t.status]++
    })
    return counts
  })

  async function fetch(projectId?: string) {
    isLoading.value = true
    currentProjectId.value = projectId ?? null
    const result = await apiClient.listTasks(projectId)
    if (result.ok) tasks.value = result.tasks
    isLoading.value = false
  }

  async function create(doc: Parameters<typeof apiClient.createTask>[0]) {
    const result = await apiClient.createTask(doc)
    if (result.ok) tasks.value = [...tasks.value, result.task]
    return result
  }

  async function update(id: string, changes: Partial<Task>) {
    const result = await apiClient.updateTask(id, changes)
    if (result.ok) {
      tasks.value = tasks.value.map((t) => (t._id === id ? result.task : t))
    }
    return result
  }

  async function updateStatus(id: string, status: Task['status']) {
    return update(id, { status })
  }

  async function remove(id: string) {
    const result = await apiClient.deleteTask(id)
    if (result.ok) {
      tasks.value = tasks.value.filter((t) => t._id !== id)
    }
    return result
  }

  async function resume(id: string) {
    const result = await apiClient.resumeTask(id)
    return result
  }

  return { tasks, isLoading, currentProjectId, filteredTasks, stats, fetch, create, update, updateStatus, remove, resume }
})
