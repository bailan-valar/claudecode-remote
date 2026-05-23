<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { TASK_STATUS, type TaskStatus, KIND_LABEL } from '../../../shared/constants'
import type { Task } from '../../../shared/types'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'
import { formatDurationShort } from '../utils/formatDuration'
import { calculateLiveDuration, isTracking } from '../utils/timeTracking'

const props = defineProps<{
  tasks: Task[]
  projectNameMap: Map<string, string>
  tick?: number
}>()

const emit = defineEmits<{
  move: [taskId: string, status: TaskStatus]
  edit: [taskId: string]
  delete: [taskId: string]
}>()

const statusList = Object.values(TASK_STATUS) as TaskStatus[]

const grouped = computed(() => {
  const map = {} as Record<TaskStatus, Task[]>
  statusList.forEach((s) => {
    map[s] = props.tasks.filter((t) => t.status === s)
  })
  return map
})

function onDragStart(e: DragEvent, taskId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    const card = e.target as HTMLElement
    card.classList.add('dragging')
  }
}

function onDragEnd(e: DragEvent) {
  const card = e.target as HTMLElement
  card.classList.remove('dragging')
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  const col = e.currentTarget as HTMLElement
  col.classList.add('drag-over')
}

function onDragLeave(e: DragEvent) {
  const col = e.currentTarget as HTMLElement
  col.classList.remove('drag-over')
}

function onDrop(e: DragEvent, status: TaskStatus) {
  e.preventDefault()
  const col = e.currentTarget as HTMLElement
  col.classList.remove('drag-over')
  const taskId = e.dataTransfer?.getData('text/plain')
  if (taskId) {
    emit('move', taskId, status)
  }
}

function taskDuration(task: Task) {
  void props.tick
  return calculateLiveDuration(task)
}
</script>

<template>
  <div class="kanban">
    <div
      v-for="status in statusList"
      :key="status"
      class="kanban-column"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop($event, status)"
    >
      <div class="column-header">
        <span class="dot" :style="{ backgroundColor: STATUS_COLOR[status] }"></span>
        <span class="label" :style="{ color: STATUS_COLOR[status] }">{{ STATUS_LABEL[status] }}</span>
        <span class="count">{{ grouped[status].length }}</span>
      </div>
      <div class="column-body">
        <div
          v-for="task in grouped[status]"
          :key="task._id"
          class="kanban-card glass"
          draggable="true"
          @dragstart="onDragStart($event, task._id)"
          @dragend="onDragEnd"
        >
          <RouterLink :to="{ name: 'task-detail', params: { id: task._id } }" class="card-title">
            {{ task.title }}
          </RouterLink>
          <div class="card-meta">
            <span class="kind">{{ KIND_LABEL[task.kind] ?? task.kind ?? '任务' }}</span>
            <span class="project">{{ projectNameMap.get(task.projectId) ?? task.projectId }}</span>
            <span v-if="(task.totalDuration ?? 0) > 0 || isTracking(task)" class="duration" :class="{ 'duration-active': isTracking(task) }">
              {{ formatDurationShort(taskDuration(task)) }}
              <span v-if="isTracking(task)" class="tracking-dot">●</span>
            </span>
          </div>
          <div class="card-actions">
            <button class="glass-button btn-edit" @click="emit('edit', task._id)">编辑</button>
            <button class="glass-button danger btn-delete" @click="emit('delete', task._id)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban {
  display: flex;
  gap: var(--space-md);
  overflow-x: auto;
  padding-bottom: var(--space-md);
  min-height: 400px;
}

.kanban-column {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 260px);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}

.kanban-column.drag-over {
  background: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 2px var(--color-accent);
}

.column-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  font-weight: 600;
  font-size: 0.9375rem;
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--glass-bg-strong);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow-y: auto;
  flex: 1;
}

.kanban-card {
  padding: var(--space-md);
  cursor: grab;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.kanban-card:active {
  cursor: grabbing;
}

.kanban-card.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

.card-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-sm);
  line-height: 1.4;
}

.card-title:hover {
  color: var(--color-accent);
}

.card-meta {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.kind {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-subtle);
}

.duration {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.tracking-dot {
  color: #34c759;
  margin-left: 1px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.card-actions {
  display: flex;
  gap: var(--space-sm);
}

.card-actions .glass-button {
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  min-height: 28px;
  flex: 1;
}

@media (max-width: 640px) {
  .kanban {
    gap: var(--space-sm);
  }
  .kanban-column {
    flex: 0 0 260px;
    padding: var(--space-sm);
  }
}
</style>
