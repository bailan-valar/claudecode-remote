<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Task } from '../../../shared/types'
import type { TaskStatus } from '../../../shared/constants'
import { KIND_LABEL } from '../../../shared/constants'
import StatusBadge from './StatusBadge.vue'
import TaskStatusActions from './TaskStatusActions.vue'
import { formatDurationShort } from '../utils/formatDuration'
import { calculateLiveDuration, isTracking } from '../utils/timeTracking'

interface Props {
  task: Task
  mode?: 'list' | 'kanban' | 'compact'
  projectName?: string
  tick?: number
  draggable?: boolean
  showPriority?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'list',
  showPriority: false,
})

const PRIORITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#34c759',
  medium: '#ff9500',
  high: '#ff3b30',
}

const emit = defineEmits<{
  navigate: [taskId: string]
  transition: [status: TaskStatus]
  edit: [taskId: string]
  delete: [taskId: string]
  dragstart: [e: DragEvent, taskId: string]
  dragend: [e: DragEvent]
}>()

function duration() {
  void props.tick
  return calculateLiveDuration(props.task)
}

function onDragStart(e: DragEvent) {
  if (props.mode === 'kanban') {
    const card = e.currentTarget as HTMLElement
    card.classList.add('dragging')
  }
  emit('dragstart', e, props.task._id)
}

function onDragEnd(e: DragEvent) {
  if (props.mode === 'kanban') {
    const card = e.currentTarget as HTMLElement
    card.classList.remove('dragging')
  }
  emit('dragend', e)
}
</script>

<template>
  <!-- List mode -->
  <li
    v-if="mode === 'list'"
    class="task-list-item glass glass-hover"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="row">
      <StatusBadge :status="task.status" />
      <span class="kind-badge">{{ KIND_LABEL[task.kind] ?? task.kind ?? '任务' }}</span>
      <span
        v-if="showPriority"
        class="priority-badge"
        :style="{
          backgroundColor: PRIORITY_COLOR[task.priority] + '18',
          color: PRIORITY_COLOR[task.priority],
          borderColor: PRIORITY_COLOR[task.priority] + '30',
        }"
      >
        {{ PRIORITY_LABEL[task.priority] ?? task.priority }}
      </span>
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="title"
        @click="emit('navigate', task._id)"
      >
        {{ task.title }}
      </RouterLink>
      <span v-if="projectName" class="project">{{ projectName }}</span>
      <span
        v-if="(task.totalDuration ?? 0) > 0 || isTracking(task)"
        class="duration"
        :class="{ 'duration-active': isTracking(task) }"
      >
        {{ formatDurationShort(duration()) }}
        <span v-if="isTracking(task)" class="tracking-dot">●</span>
      </span>
    </div>
    <div class="actions">
      <TaskStatusActions :status="task.status" @transition="emit('transition', $event)" />
      <button class="glass-button btn-edit" @click="emit('edit', task._id)">编辑</button>
      <button class="glass-button danger btn-delete" @click="emit('delete', task._id)">删除</button>
    </div>
  </li>

  <!-- Kanban mode -->
  <div
    v-else-if="mode === 'kanban'"
    class="task-kanban-item glass"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <RouterLink
      :to="{ name: 'task-detail', params: { id: task._id } }"
      class="card-title"
      @click="emit('navigate', task._id)"
    >
      {{ task.title }}
    </RouterLink>
    <div class="card-meta">
      <span class="kind">{{ KIND_LABEL[task.kind] ?? task.kind ?? '任务' }}</span>
      <span v-if="projectName" class="project">{{ projectName }}</span>
      <span
        v-if="(task.totalDuration ?? 0) > 0 || isTracking(task)"
        class="duration"
        :class="{ 'duration-active': isTracking(task) }"
      >
        {{ formatDurationShort(duration()) }}
        <span v-if="isTracking(task)" class="tracking-dot">●</span>
      </span>
    </div>
    <div class="card-actions">
      <button class="glass-button btn-edit" @click="emit('edit', task._id)">编辑</button>
      <button class="glass-button danger btn-delete" @click="emit('delete', task._id)">删除</button>
    </div>
  </div>

  <!-- Compact mode -->
  <li
    v-else-if="mode === 'compact'"
    class="task-compact-item glass"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="compact-row">
      <StatusBadge :status="task.status" />
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="compact-title"
        @click="emit('navigate', task._id)"
      >
        {{ task.title }}
      </RouterLink>
    </div>
  </li>
</template>

<style scoped>
/* List mode */
.task-list-item {
  padding: var(--space-lg);
  cursor: default;
  list-style: none;
}

.task-list-item .row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}

.task-list-item .title {
  flex: 1;
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--color-text);
  text-decoration: none;
  min-width: 0;
  letter-spacing: -0.01em;
}

.task-list-item .title:hover {
  color: var(--color-accent);
  opacity: 1;
}

.task-list-item .kind-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid var(--glass-border-subtle);
}

.task-list-item .priority-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.task-list-item .project {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.task-list-item .duration {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.task-list-item .duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.task-list-item .tracking-dot {
  color: #34c759;
  margin-left: 2px;
  animation: pulse 1.5s infinite;
}

.task-list-item .actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
}

.task-list-item .actions :deep(.actions) {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.task-list-item .actions .glass-button {
  font-size: 0.8125rem;
  padding: var(--space-xs) var(--space-md);
  min-height: 32px;
}

/* Kanban mode */
.task-kanban-item {
  padding: var(--space-sm);
  cursor: grab;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  border-radius: var(--radius-sm);
}

.task-kanban-item:active {
  cursor: grabbing;
}

.task-kanban-item .card-title {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--color-text);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-xs);
  line-height: 1.35;
}

.task-kanban-item .card-title:hover {
  color: var(--color-accent);
}

.task-kanban-item .card-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-kanban-item .kind {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 0px 5px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-subtle);
}

.task-kanban-item .duration {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.task-kanban-item .duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.task-kanban-item .tracking-dot {
  color: #34c759;
  margin-left: 1px;
  animation: pulse 1.5s infinite;
}

.task-kanban-item .card-actions {
  display: flex;
  gap: var(--space-xs);
}

.task-kanban-item .card-actions .glass-button {
  font-size: 0.6875rem;
  padding: 2px var(--space-sm);
  min-height: 24px;
  flex: 1;
}

/* Compact mode */
.task-compact-item {
  padding: var(--space-md);
  list-style: none;
}

.task-compact-item .compact-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.task-compact-item .compact-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
  text-decoration: none;
}

.task-compact-item .compact-title:hover {
  color: var(--color-accent);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 640px) {
  .task-list-item {
    padding: var(--space-md);
  }

  .task-list-item .actions {
    width: 100%;
    margin-top: var(--space-sm);
  }

  .task-list-item .actions .glass-button {
    font-size: 0.875rem;
    padding: var(--space-sm) var(--space-md);
    flex: 1;
    min-height: 40px;
  }

  .task-kanban-item .card-actions .glass-button {
    min-height: 36px;
    font-size: 0.8125rem;
  }

  /* 手机端更紧凑的样式 */
  .task-list-item.compact {
    padding: var(--space-sm) var(--space-md);
  }

  .task-list-item.compact .row {
    margin-bottom: var(--space-xs);
  }

  .task-compact-item {
    padding: var(--space-sm) var(--space-md);
  }
}
</style>

