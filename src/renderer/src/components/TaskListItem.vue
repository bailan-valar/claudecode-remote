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
    <div class="task-main">
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="title"
        @click="emit('navigate', task._id)"
      >
        {{ task.title }}
      </RouterLink>
      <div class="task-header">
        <div class="task-badges">
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
        </div>
        <div class="task-meta">
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
      </div>
    </div>
    <div class="actions">
      <TaskStatusActions :status="task.status" @transition="emit('transition', $event)" />
      <div class="action-buttons">
        <button class="glass-button btn-edit" @click="emit('edit', task._id)">编辑</button>
        <button class="glass-button danger btn-delete" @click="emit('delete', task._id)">删除</button>
      </div>
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
    <div class="card-header">
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="card-title"
        @click="emit('navigate', task._id)"
      >
        {{ task.title }}
      </RouterLink>
    </div>
    <div class="card-meta">
      <div class="card-badges">
        <span class="kind">{{ KIND_LABEL[task.kind] ?? task.kind ?? '任务' }}</span>
        <span v-if="projectName" class="project">{{ projectName }}</span>
      </div>
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
    class="task-compact-item"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="compact-main">
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="compact-title"
        @click="emit('navigate', task._id)"
      >
        {{ task.title }}
      </RouterLink>
      <div class="compact-meta">
        <StatusBadge :status="task.status" size="small" />
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
    </div>
    <div class="compact-actions">
      <button class="glass-button btn-icon btn-edit" @click="emit('edit', task._id)">
        <span>✏️</span>
      </button>
      <button class="glass-button btn-icon danger btn-delete" @click="emit('delete', task._id)">
        <span>🗑️</span>
      </button>
    </div>
  </li>
</template>

<style scoped>
/* List mode - 更紧凑的设计 */
.task-list-item {
  padding: var(--space-md) var(--space-lg);
  cursor: default;
  list-style: none;
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  transition: all var(--transition-fast);
  border-radius: var(--radius-md);
  min-height: 80px;
}

.task-list-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.task-list-item .task-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.task-list-item .task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  padding-top: 2px;
}

.task-list-item .task-badges {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-list-item .task-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-list-item .title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.01em;
  line-height: 1.4;
  transition: color var(--transition-fast);
  display: block;
  margin-bottom: 2px;
}

.task-list-item .title:hover {
  color: var(--color-accent);
}

.task-list-item .kind-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.05);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid var(--glass-border-subtle);
  transition: all var(--transition-fast);
}

.task-list-item .kind-badge:hover {
  background: rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.task-list-item .priority-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all var(--transition-fast);
}

.task-list-item .priority-badge:hover {
  transform: scale(1.05);
}

.task-list-item .project {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-list-item .project::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 3px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.6;
}

.task-list-item .duration {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all var(--transition-fast);
}

.task-list-item .duration:hover {
  background: rgba(0, 0, 0, 0.06);
}

.task-list-item .duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.task-list-item .tracking-dot {
  color: #34c759;
  margin-left: 0;
  animation: pulse 1.5s infinite;
}

.task-list-item .actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  align-items: stretch;
  flex-shrink: 0;
  min-width: 120px;
}

.task-list-item .actions :deep(.actions) {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-list-item .action-buttons {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-list-item .actions .glass-button {
  font-size: 0.75rem;
  padding: var(--space-xs) var(--space-sm);
  min-height: 28px;
  transition: all var(--transition-fast);
}

.task-list-item .actions .glass-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Kanban mode */
.task-kanban-item {
  padding: var(--space-sm);
  cursor: grab;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.task-kanban-item:active {
  cursor: grabbing;
}

.task-kanban-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.task-kanban-item .card-header {
  margin-bottom: var(--space-xs);
}

.task-kanban-item .card-title {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--color-text);
  text-decoration: none;
  display: block;
  line-height: 1.35;
  transition: color var(--transition-fast);
}

.task-kanban-item .card-title:hover {
  color: var(--color-accent);
}

.task-kanban-item .card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-xs);
}

.task-kanban-item .card-badges {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.task-kanban-item .kind {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-subtle);
  transition: all var(--transition-fast);
}

.task-kanban-item .kind:hover {
  background: rgba(0, 0, 0, 0.06);
}

.task-kanban-item .project {
  color: var(--color-text-secondary);
  font-size: 0.625rem;
  font-weight: 500;
}

.task-kanban-item .duration {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.task-kanban-item .duration:hover {
  background: rgba(0, 0, 0, 0.06);
}

.task-kanban-item .duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.task-kanban-item .tracking-dot {
  color: #34c759;
  margin-left: 2px;
  animation: pulse 1.5s infinite;
}

.task-kanban-item .card-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.task-kanban-item .card-actions .glass-button {
  font-size: 0.625rem;
  padding: 4px var(--space-sm);
  min-height: 24px;
  flex: 1;
  transition: all var(--transition-fast);
}

.task-kanban-item .card-actions .glass-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Compact mode - 重新设计为超紧凑布局 */
.task-compact-item {
  padding: 2px 4px;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  transition: background-color var(--transition-fast), transform var(--transition-fast);
  border-radius: 0;
  min-height: 24px;
  border-bottom: 1px solid var(--glass-border-subtle);
  background-color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.task-compact-item:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

/* 移动端触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .task-compact-item:active {
    background-color: rgba(0, 122, 255, 0.1);
    transform: scale(0.99);
  }
}

.task-compact-item .compact-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.task-compact-item .compact-title {
  font-weight: 500;
  font-size: 0.625rem;
  color: var(--color-text);
  text-decoration: none;
  transition: color var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.task-compact-item .compact-title:hover {
  color: var(--color-accent);
}

.task-compact-item .compact-meta {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-wrap: nowrap;
  font-size: 0.5rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  flex-shrink: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.task-compact-item .compact-meta .kind {
  font-weight: 500;
  background: rgba(0, 0, 0, 0.02);
  padding: 1px 2px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-subtle);
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-size: 0.5rem;
}

.task-compact-item .compact-meta .kind:hover {
  background: rgba(0, 0, 0, 0.04);
}

.task-compact-item .compact-meta .project {
  display: flex;
  align-items: center;
  gap: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50px;
  font-size: 0.5rem;
}

.task-compact-item .compact-meta .project::before {
  content: '';
  display: inline-block;
  width: 1.5px;
  height: 1.5px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.5;
  flex-shrink: 0;
}

.task-compact-item .compact-meta .duration {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(0, 0, 0, 0.02);
  padding: 1px 2px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-size: 0.5rem;
}

.task-compact-item .compact-meta .duration:hover {
  background: rgba(0, 0, 0, 0.04);
}

.task-compact-item .compact-meta .duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.05);
  font-weight: 500;
}

.task-compact-item .compact-actions {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
  align-items: center;
}

.task-compact-item .compact-actions .btn-icon {
  font-size: 0.75rem;
  padding: 2px;
  min-height: 18px;
  min-width: 18px;
  max-width: 18px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.task-compact-item .compact-actions .btn-icon:hover {
  transform: scale(1.15);
  background: rgba(0, 0, 0, 0.03);
  border-color: var(--glass-border-subtle);
}

/* 移动端按钮触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .task-compact-item .compact-actions .btn-icon:active {
    transform: scale(0.9);
    background: rgba(0, 122, 255, 0.15);
  }
}

.task-compact-item .compact-actions .btn-icon span {
  font-size: 0.5625rem;
  line-height: 1;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 640px) {
  .task-list-item {
    padding: var(--space-sm) var(--space-md);
    flex-direction: column;
    gap: var(--space-sm);
    min-height: auto;
  }

  .task-list-item .task-main {
    gap: var(--space-xs);
  }

  .task-list-item .title {
    font-size: 0.9375rem;
    line-height: 1.3;
  }

  .task-list-item .task-header {
    justify-content: flex-start;
    gap: var(--space-xs);
  }

  .task-list-item .task-badges {
    gap: 4px;
  }

  .task-list-item .task-meta {
    width: 100%;
    justify-content: flex-start;
    gap: 4px;
  }

  .task-list-item .kind-badge,
  .task-list-item .priority-badge {
    font-size: 0.625rem;
    padding: 2px 6px;
  }

  .task-list-item .project {
    font-size: 0.6875rem;
  }

  .task-list-item .duration {
    font-size: 0.6875rem;
    padding: 2px 5px;
  }

  .task-list-item .actions {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--glass-border-subtle);
    padding-top: var(--space-xs);
    margin-top: 2px;
    min-width: auto;
    gap: var(--space-xs);
  }

  .task-list-item .actions :deep(.actions) {
    flex: 1;
    gap: var(--space-xs);
  }

  .task-list-item .action-buttons {
    flex: 1;
    justify-content: flex-end;
    gap: var(--space-xs);
  }

  .task-list-item .actions .glass-button {
    font-size: 0.8125rem;
    padding: var(--space-xs) var(--space-sm);
    min-height: 36px;
  }

  .task-kanban-item .card-actions .glass-button {
    min-height: 36px;
    font-size: 0.8125rem;
    padding: var(--space-xs) var(--space-sm);
  }

  /* 优化移动端的紧凑模式 */
  .task-compact-item {
    padding: 3px 4px;
    min-height: 26px;
    gap: 3px;
  }

  .task-compact-item .compact-main {
    flex: 1;
    gap: 1px;
    min-width: 0;
  }

  .task-compact-item .compact-title {
    font-size: 0.625rem;
    line-height: 1;
  }

  .task-compact-item .compact-meta {
    font-size: 0.5rem;
    gap: 1px;
  }

  .task-compact-item .compact-meta .kind {
    font-size: 0.475rem;
    padding: 1px 2px;
  }

  .task-compact-item .compact-meta .project {
    font-size: 0.475rem;
    max-width: 40px;
  }

  .task-compact-item .compact-meta .duration {
    font-size: 0.475rem;
    padding: 1px 2px;
  }

  .task-compact-item .compact-actions {
    gap: 1px;
  }

  .task-compact-item .compact-actions .btn-icon {
    min-height: 20px;
    min-width: 20px;
    max-width: 20px;
    padding: 2px;
  }

  .task-compact-item .compact-actions .btn-icon span {
    font-size: 0.5625rem;
  }
}
</style>

