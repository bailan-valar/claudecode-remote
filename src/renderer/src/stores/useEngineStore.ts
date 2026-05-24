import { defineStore } from 'pinia'
import { ref, onMounted, onUnmounted } from 'vue'
import { apiClient } from '../api'
import { useTaskStore } from './useTaskStore'

export interface EngineStatus {
  running: boolean
  runningCount: number
  queueSize: number
  currentTaskIds: string[]
  concurrency: number
  provider: string
}

export const useEngineStore = defineStore('engine', () => {
  const status = ref<EngineStatus>({
    running: false,
    runningCount: 0,
    queueSize: 0,
    currentTaskIds: [],
    concurrency: 1,
    provider: 'anthropic',
  })

  const providers = ref<Array<{ provider: string; name: string }>>([])

  let unsubStatus: (() => void) | null = null
  let unsubCompleted: (() => void) | null = null
  let unsubFailed: (() => void) | null = null
  let unsubLogsUpdated: (() => void) | null = null

  async function fetchStatus() {
    const result = await apiClient.getEngineStatus()
    if (result.ok && result.status) {
      status.value = result.status
    }
  }

  async function fetchProviders() {
    const result = await apiClient.listEngineProviders()
    if (result.ok && result.providers) {
      providers.value = result.providers
    }
  }

  async function fetchProvider() {
    const result = await apiClient.getEngineProvider()
    if (result.ok && result.provider) {
      status.value.provider = result.provider
    }
  }

  async function setProvider(name: string) {
    const result = await apiClient.setEngineProvider(name)
    if (result.ok) {
      status.value.provider = name
    }
    return result
  }

  async function start() {
    const result = await apiClient.startEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function stop() {
    const result = await apiClient.stopEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function pause() {
    const result = await apiClient.pauseEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function resume() {
    const result = await apiClient.resumeEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function setConcurrency(n: number) {
    const result = await apiClient.setEngineConcurrency(n)
    if (result.ok) await fetchStatus()
    return result
  }

  function listen() {
    const taskStore = useTaskStore()
    unsubStatus = apiClient.onEngineStatus((s: EngineStatus) => {
      status.value = s
    })
    unsubCompleted = apiClient.onEngineTaskCompleted((taskId: string) => {
      console.log('[engine] task completed:', taskId)
      // 自动刷新任务列表
      taskStore.fetch()
    })
    unsubFailed = apiClient.onEngineTaskFailed((taskId: string, error: string) => {
      console.error('[engine] task failed:', taskId, error)
      // 自动刷新任务列表
      taskStore.fetch()
    })
    unsubLogsUpdated = apiClient.onEngineTaskLogsUpdated((taskId: string, logs: any[]) => {
      console.log('[engine] task logs updated:', taskId, 'logs count:', logs.length)
      // 自动刷新任务列表，获取最新的日志和阶段历史
      taskStore.fetch()
    })
  }

  function unlisten() {
    unsubStatus?.()
    unsubCompleted?.()
    unsubFailed?.()
    unsubLogsUpdated?.()
    unsubStatus = null
    unsubCompleted = null
    unsubFailed = null
    unsubLogsUpdated = null
  }

  onMounted(() => {
    fetchStatus()
    fetchProviders()
    fetchProvider()
    listen()
  })

  onUnmounted(() => {
    unlisten()
  })

  return { status, providers, fetchStatus, fetchProviders, fetchProvider, setProvider, start, stop, pause, resume, setConcurrency, listen, unlisten }
})
