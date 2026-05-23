import { defineStore } from 'pinia'
import { ref, onMounted, onUnmounted } from 'vue'

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

  async function fetchStatus() {
    const result = await window.api.getEngineStatus()
    if (result.ok && result.status) {
      status.value = result.status
    }
  }

  async function fetchProviders() {
    const result = await window.api.listEngineProviders()
    if (result.ok && result.providers) {
      providers.value = result.providers
    }
  }

  async function fetchProvider() {
    const result = await window.api.getEngineProvider()
    if (result.ok && result.provider) {
      status.value.provider = result.provider
    }
  }

  async function setProvider(name: string) {
    const result = await window.api.setEngineProvider(name)
    if (result.ok) {
      status.value.provider = name
    }
    return result
  }

  async function start() {
    const result = await window.api.startEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function stop() {
    const result = await window.api.stopEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function pause() {
    const result = await window.api.pauseEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function resume() {
    const result = await window.api.resumeEngine()
    if (result.ok) await fetchStatus()
    return result
  }

  async function setConcurrency(n: number) {
    const result = await window.api.setEngineConcurrency(n)
    if (result.ok) await fetchStatus()
    return result
  }

  function listen() {
    unsubStatus = window.api.onEngineStatus((s: EngineStatus) => {
      status.value = s
    })
    unsubCompleted = window.api.onEngineTaskCompleted((taskId: string) => {
      console.log('[engine] task completed:', taskId)
    })
    unsubFailed = window.api.onEngineTaskFailed((taskId: string, error: string) => {
      console.error('[engine] task failed:', taskId, error)
    })
  }

  function unlisten() {
    unsubStatus?.()
    unsubCompleted?.()
    unsubFailed?.()
    unsubStatus = null
    unsubCompleted = null
    unsubFailed = null
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
