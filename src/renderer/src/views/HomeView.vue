<script setup lang="ts">
import { onMounted, defineOptions } from 'vue'
import { useSyncStore } from '../stores/useSyncStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import { useEngineStore } from '../stores/useEngineStore'
import { storeToRefs } from 'pinia'

defineOptions({
  name: 'HomeView'
})

const store = useSyncStore()
const { status } = storeToRefs(store)
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const engineStore = useEngineStore()

onMounted(() => {
  projectStore.fetch()
  taskStore.fetch()
  engineStore.fetchStatus()
  engineStore.listen()
})

function dotClass(phase: string): string {
  switch (phase) {
    case 'active':
      return 'active'
    case 'paused':
      return 'paused'
    case 'error':
      return 'error'
    default:
      return 'connecting'
  }
}

function statusText(phase: string): string {
  switch (phase) {
    case 'active':
      return '同步中'
    case 'paused':
      return '空闲'
    case 'error':
      return '连接失败'
    default:
      return '连接中...'
  }
}
</script>

<template>
  <main class="home">
    <h1 class="page-title">概览</h1>

    <section class="sync-card glass">
      <div class="sync-header">
        <span :class="['dot', dotClass(status.phase)]" />
        <h2>CouchDB 同步状态</h2>
      </div>
      <div class="sync-body">
        <p class="phase">{{ statusText(status.phase) }}</p>
        <p v-if="status.lastChange != null" class="detail">
          最近变更 {{ status.lastChange }} 个文档
        </p>
        <p v-if="status.message" class="error">{{ status.message }}</p>
      </div>
      <button class="glass-button" @click="store.refresh">刷新连接</button>
    </section>

    <section class="engine-card glass">
      <div class="engine-header">
        <h2>任务引擎</h2>
        <span :class="['dot', engineStore.status.running ? 'active' : 'paused']" />
      </div>
      <div class="engine-body">
        <p class="phase">{{ engineStore.status.running ? '运行中' : '已停止' }}</p>
        <p class="detail">
          运行中: {{ engineStore.status.runningCount }} / 队列: {{ engineStore.status.queueSize }}
        </p>
      </div>
      <div class="engine-actions">
        <button
          v-if="!engineStore.status.running"
          class="glass-button primary"
          @click="engineStore.start()"
        >
          启动
        </button>
        <button v-else class="glass-button danger" @click="engineStore.stop()">停止</button>
        <button
          v-if="engineStore.status.running"
          class="glass-button"
          @click="engineStore.pause()"
        >
          暂停
        </button>
        <button
          v-if="!engineStore.status.running"
          class="glass-button"
          @click="engineStore.resume()"
        >
          恢复
        </button>
      </div>
      <div class="engine-provider">
        <label>执行引擎</label>
        <select
          class="glass-input"
          :value="engineStore.status.provider"
          @change="engineStore.setProvider(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="p in engineStore.providers"
            :key="p.provider"
            :value="p.provider"
          >
            {{ p.name }}
          </option>
        </select>
      </div>
      <div class="engine-concurrency">
        <label>并发数: {{ engineStore.status.concurrency }}</label>
        <input
          type="range"
          min="1"
          max="5"
          :value="engineStore.status.concurrency"
          @change="engineStore.setConcurrency(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat-card glass">
        <span class="stat-value">{{ projectStore.projects.length }}</span>
        <span class="stat-label">项目</span>
      </div>
      <div class="stat-card glass">
        <span class="stat-value">{{ taskStore.tasks.length }}</span>
        <span class="stat-label">总任务</span>
      </div>
      <div class="stat-card glass">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'completed').length }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-card glass">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'developing').length }}</span>
        <span class="stat-label">开发中</span>
      </div>
      <div class="stat-card glass">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'pending').length }}</span>
        <span class="stat-label">待开发</span>
      </div>
      <div class="stat-card glass">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'reviewing').length }}</span>
        <span class="stat-label">待审核</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home {
  max-width: 520px;
  margin: 0 auto;
}

.sync-card,
.engine-card {
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.sync-header,
.engine-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.sync-header h2,
.engine-header h2 {
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  margin: 0;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-muted);
  transition: background 0.3s ease;
  position: relative;
}

.dot.connecting {
  background: var(--color-warning);
  animation: pulse 1.5s infinite;
}

.dot.active {
  background: var(--color-success);
}

.dot.paused {
  background: var(--color-muted);
}

.dot.error {
  background: var(--color-error);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.sync-body,
.engine-body {
  margin-bottom: var(--space-md);
}

.phase {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--space-xs);
  letter-spacing: -0.01em;
}

.detail {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
  margin-top: var(--space-sm);
}

.engine-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.engine-provider {
  margin-top: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.engine-provider label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  min-width: 80px;
  font-weight: 500;
}

.engine-provider select {
  flex: 1;
  min-width: 0;
}

.engine-concurrency {
  margin-top: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.engine-concurrency label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  min-width: 80px;
  font-weight: 500;
}

.engine-concurrency input[type='range'] {
  flex: 1;
  accent-color: var(--color-accent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.stat-card {
  padding: var(--space-lg);
  text-align: center;
  transition: transform var(--transition-fast);
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
  margin-bottom: var(--space-xs);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}
</style>
