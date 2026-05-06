import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task } from '../../../shared/types'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)
  const currentProjectId = ref<string | null>(null)

  const filteredTasks = computed(() => {
    if (!currentProjectId.value) return tasks.value
    return tasks.value.filter((t) => t.projectId === currentProjectId.value)
  })

  async function fetch(projectId?: string) {
    isLoading.value = true
    const result = await window.api.listTasks(projectId)
    if (result.ok) tasks.value = result.tasks
    isLoading.value = false
  }

  async function create(doc: Parameters<typeof window.api.createTask>[0]) {
    const result = await window.api.createTask(doc)
    if (result.ok) tasks.value = [...tasks.value, result.task]
    return result
  }

  async function updateStatus(id: string, status: Task['status']) {
    const result = await window.api.updateTask(id, { status })
    if (result.ok) {
      tasks.value = tasks.value.map((t) => (t._id === id ? result.task : t))
    }
    return result
  }

  async function remove(id: string) {
    const result = await window.api.deleteTask(id)
    if (result.ok) {
      tasks.value = tasks.value.filter((t) => t._id !== id)
    }
    return result
  }

  return { tasks, isLoading, currentProjectId, filteredTasks, fetch, create, updateStatus, remove }
})
