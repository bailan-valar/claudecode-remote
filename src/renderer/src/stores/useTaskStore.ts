import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '../api'
import type { Task } from '../../../shared/types'
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

// 用于确保只设置一次监听器
let listenersSetup = false

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

  // 设置实时事件监听
  function setupListeners() {
    if (listenersSetup) return
    listenersSetup = true

    apiClient.onTaskCreated((task: Task) => {
      // 检查是否已存在（避免重复添加）
      const existingIndex = tasks.value.findIndex((t) => t._id === task._id)
      if (existingIndex === -1) {
        tasks.value = [...tasks.value, task]
      } else {
        // 如果已存在，更新它
        tasks.value = tasks.value.map((t) => (t._id === task._id ? task : t))
      }
    })

    apiClient.onTaskUpdated((task: Task) => {
      tasks.value = tasks.value.map((t) => (t._id === task._id ? task : t))
    })

    apiClient.onTaskDeleted((id: string) => {
      tasks.value = tasks.value.filter((t) => t._id !== id)
    })
  }

  async function fetch(projectId?: string) {
    isLoading.value = true
    currentProjectId.value = projectId ?? null
    const result = await apiClient.listTasks(projectId)
    if (result.ok) tasks.value = result.tasks
    isLoading.value = false
    // 首次 fetch 时设置监听器
    setupListeners()
  }

  async function create(doc: Parameters<typeof apiClient.createTask>[0]) {
    const result = await apiClient.createTask(doc)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  async function update(id: string, changes: Partial<Task>) {
    const result = await apiClient.updateTask(id, changes)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  async function updateStatus(id: string, status: Task['status']) {
    return update(id, { status })
  }

  async function remove(id: string) {
    const result = await apiClient.deleteTask(id)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  async function resume(id: string) {
    const result = await apiClient.resumeTask(id)
    return result
  }

  return { tasks, isLoading, currentProjectId, filteredTasks, stats, fetch, create, update, updateStatus, remove, resume }
})
