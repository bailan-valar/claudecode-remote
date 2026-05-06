import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '../../../shared/types'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const isLoading = ref(false)

  async function fetch() {
    isLoading.value = true
    const result = await window.api.listProjects()
    if (result.ok) projects.value = result.projects
    isLoading.value = false
  }

  async function create(doc: Parameters<typeof window.api.createProject>[0]) {
    const result = await window.api.createProject(doc)
    if (result.ok) projects.value = [...projects.value, result.project]
    return result
  }

  async function update(id: string, changes: Partial<Project>) {
    const result = await window.api.updateProject(id, changes)
    if (result.ok) {
      projects.value = projects.value.map((p) => (p._id === id ? result.project : p))
    }
    return result
  }

  async function remove(id: string) {
    const result = await window.api.deleteProject(id)
    if (result.ok) {
      projects.value = projects.value.filter((p) => p._id !== id)
    }
    return result
  }

  return { projects, isLoading, fetch, create, update, remove }
})
