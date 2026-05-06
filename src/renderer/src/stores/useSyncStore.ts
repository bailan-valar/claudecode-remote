import { defineStore } from 'pinia'
import { ref, onScopeDispose } from 'vue'

export interface SyncStatus {
  phase: string
  lastChange?: number
  message?: string
}

export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>({ phase: 'connecting' })

  const off = window.api.onSyncStatus((s) => {
    status.value = s
  })
  onScopeDispose(() => off())

  async function refresh() {
    await window.api.refreshSync()
  }

  return { status, refresh }
})
