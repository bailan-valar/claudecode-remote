import { defineStore } from 'pinia'
import { ref, onScopeDispose } from 'vue'
import { apiClient } from '../api'

export interface SyncStatus {
  phase: string
  lastChange?: number
  message?: string
}

export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>({ phase: 'connecting' })

  const off = apiClient.onSyncStatus((s) => {
    status.value = s
  })
  onScopeDispose(() => off())

  async function refresh() {
    await apiClient.refreshSync()
  }

  return { status, refresh }
})
