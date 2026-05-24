<template>
  <div class="restart-controls">
    <h3>系统重启控制</h3>
    
    <!-- 重启状态显示 -->
    <div class="status-panel">
      <div v-if="restartStatus.isPendingRestart" class="warning">
        ⚠️ 系统将在 {{ restartStatus.countdown }} 秒后重启
      </div>
      <div v-else class="normal">
        ✅ 系统运行正常
      </div>
    </div>

    <!-- 手动重启按钮 -->
    <div class="control-buttons">
      <button @click="immediateRestart" :disabled="restartStatus.isPendingRestart">
        立即重启
      </button>
      <button @click="delayedRestart" :disabled="restartStatus.isPendingRestart">
        延迟重启 (10秒)
      </button>
      <button @click="cancelRestart" :disabled="!restartStatus.isPendingRestart">
        取消重启
      </button>
    </div>

    <!-- 重启历史 -->
    <div class="restart-history">
      <h4>重启历史</h4>
      <ul>
        <li v-for="(event, index) in restartHistory" :key="index">
          {{ event.timestamp }} - {{ event.reason }}
        </li>
      </ul>
    </div>

    <!-- 配置显示 -->
    <div class="config-info">
      <h4>当前配置</h4>
      <p>自动重启: {{ config.autoRestartOnTaskComplete ? '启用' : '禁用' }}</p>
      <p>重启延迟: {{ config.restartDelay / 1000 }} 秒</p>
      <p>最大重启次数: {{ config.maxRestartsPerHour }} 次/小时</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface RestartStatus {
  isPendingRestart: boolean
  lastRestartState: any
  countdown: number
}

interface RestartConfig {
  autoRestartOnTaskComplete: boolean
  restartDelay: number
  maxRestartsPerHour: number
}

const restartStatus = ref<RestartStatus>({
  isPendingRestart: false,
  lastRestartState: null,
  countdown: 0
})

const restartHistory = ref<any[]>([])
const config = ref<RestartConfig>({
  autoRestartOnTaskComplete: true,
  restartDelay: 3000,
  maxRestartsPerHour: 20
})

let countdownInterval: number | null = null

// 获取重启状态
const getRestartStatus = async () => {
  try {
    const response = await fetch('http://localhost:3456/api/system/restart/status')
    const data = await response.json()
    
    if (data.ok) {
      restartStatus.value = {
        ...restartStatus.value,
        isPendingRestart: data.isPendingRestart,
        lastRestartState: data.lastRestartState
      }
    }
  } catch (error) {
    console.error('Failed to get restart status:', error)
  }
}

// 立即重启
const immediateRestart = async () => {
  try {
    const response = await fetch('http://localhost:3456/api/system/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual_user_request' })
    })
    
    if (response.ok) {
      restartHistory.value.unshift({
        timestamp: new Date().toLocaleString(),
        reason: '用户手动重启'
      })
    }
  } catch (error) {
    console.error('Restart failed:', error)
  }
}

// 延迟重启
const delayedRestart = async () => {
  try {
    const response = await fetch('http://localhost:3456/api/system/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        reason: 'manual_user_delayed',
        delay: 10000 
      })
    })
    
    if (response.ok) {
      startCountdown(10)
      restartHistory.value.unshift({
        timestamp: new Date().toLocaleString(),
        reason: '用户延迟重启 (10秒)'
      })
    }
  } catch (error) {
    console.error('Delayed restart failed:', error)
  }
}

// 取消重启
const cancelRestart = async () => {
  try {
    const response = await fetch('http://localhost:3456/api/system/restart/cancel', {
      method: 'POST'
    })
    
    if (response.ok) {
      restartStatus.value.isPendingRestart = false
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }
  } catch (error) {
    console.error('Cancel restart failed:', error)
  }
}

// 倒计时
const startCountdown = (seconds: number) => {
  restartStatus.value.countdown = seconds
  restartStatus.value.isPendingRestart = true
  
  countdownInterval = setInterval(() => {
    restartStatus.value.countdown--
    if (restartStatus.value.countdown <= 0) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }
  }, 1000) as any
}

// 监听SSE事件
const setupSSE = () => {
  const eventSource = new EventSource('http://localhost:3456/api/events')
  
  eventSource.addEventListener('system:restart-imminent', (event: any) => {
    const data = JSON.parse(event.data)
    console.log('System restart imminent:', data)
    restartStatus.value.isPendingRestart = true
    startCountdown(3) // 默认3秒
  })
  
  eventSource.addEventListener('system:restarted', (event: any) => {
    const data = JSON.parse(event.data)
    console.log('System restarted:', data)
    restartHistory.value.unshift({
      timestamp: new Date().toLocaleString(),
      reason: `系统重启: ${data.reason}`
    })
  })
  
  return eventSource
}

onMounted(async () => {
  await getRestartStatus()
  setupSSE()
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})
</script>

<style scoped>
.restart-controls {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.status-panel {
  margin: 20px 0;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.warning {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}

.normal {
  background-color: #d4edda;
  border: 1px solid #28a745;
  color: #155724;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.control-buttons button {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
}

.control-buttons button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.restart-history {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.restart-history ul {
  list-style: none;
  padding: 0;
}

.restart-history li {
  padding: 5px 0;
  border-bottom: 1px solid #f8f9fa;
}

.config-info {
  margin: 20px 0;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}
</style>
