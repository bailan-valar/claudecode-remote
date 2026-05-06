<script setup lang="ts">
import { onMounted } from 'vue'
import { useSyncStore } from '../stores/useSyncStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import { storeToRefs } from 'pinia'

const store = useSyncStore()
const { status } = storeToRefs(store)
const projectStore = useProjectStore()
const taskStore = useTaskStore()

onMounted(() => {
  projectStore.fetch()
  taskStore.fetch()
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
    <h1>ClaudeCode Remote</h1>

    <section class="sync-card">
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
      <button class="refresh-btn" @click="store.refresh">刷新连接</button>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{{ projectStore.projects.length }}</span>
        <span class="stat-label">项目</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ taskStore.tasks.length }}</span>
        <span class="stat-label">总任务</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'completed').length }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ taskStore.tasks.filter((t) => t.status === 'developing').length }}</span>
        <span class="stat-label">开发中</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home {
  padding: var(--space-xl);
  max-width: 480px;
  margin: 0 auto;
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--space-lg);
  color: var(--color-text);
}

.sync-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

.sync-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.sync-header h2 {
  font-size: 1rem;
  font-weight: 500;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-muted);
  transition: background 0.3s ease;
}

.dot.connecting {
  background: #f59e0b;
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

.sync-body {
  margin-bottom: var(--space-md);
}

.phase {
  font-size: 1.125rem;
  font-weight: 500;
  margin-bottom: var(--space-xs);
}

.detail {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
  margin-top: var(--space-sm);
}

.refresh-btn {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: background 0.2s ease;
}

.refresh-btn:hover {
  background: #f3f4f6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
  margin-top: var(--space-lg);
}
.stat-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow);
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: var(--space-xs);
}
.stat-label {
  font-size: 0.875rem;
  color: var(--color-muted);
}
</style>
