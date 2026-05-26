import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '../api'
import type { Project } from '../../../shared/types'

// 用于确保只设置一次监听器
let listenersSetup = false

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const isLoading = ref(false)

  // 设置实时事件监听
  function setupListeners() {
    if (listenersSetup) return
    listenersSetup = true

    apiClient.onProjectCreated((project: Project) => {
      // 检查是否已存在（避免重复添加）
      const existingIndex = projects.value.findIndex((p) => p._id === project._id)
      if (existingIndex === -1) {
        projects.value = [...projects.value, project]
      } else {
        // 如果已存在，更新它
        projects.value = projects.value.map((p) => (p._id === project._id ? project : p))
      }
    })

    apiClient.onProjectUpdated((project: Project) => {
      projects.value = projects.value.map((p) => (p._id === project._id ? project : p))
    })

    apiClient.onProjectDeleted((id: string) => {
      projects.value = projects.value.filter((p) => p._id !== id)
    })
  }

  async function fetch() {
    isLoading.value = true
    const result = await apiClient.listProjects()
    if (result.ok) projects.value = result.projects
    isLoading.value = false
    // 首次 fetch 时设置监听器
    setupListeners()
  }

  async function create(doc: Parameters<typeof apiClient.createProject>[0]) {
    const result = await apiClient.createProject(doc)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  async function update(id: string, changes: Partial<Project>) {
    const result = await apiClient.updateProject(id, changes)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  async function remove(id: string) {
    const result = await apiClient.deleteProject(id)
    // 不再手动更新状态，由事件监听处理
    return result
  }

  return { projects, isLoading, fetch, create, update, remove }
})
