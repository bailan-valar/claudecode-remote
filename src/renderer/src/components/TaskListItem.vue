<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Task } from '../../../shared/types'
import type { TaskStatus } from '../../../shared/constants'
import { TASK_STATUS, KIND_LABEL } from '../../../shared/constants'
import { getAllowedNext } from '../utils/taskTransitions'
import StatusBadge from './StatusBadge.vue'
import TaskStatusActions from './TaskStatusActions.vue'
import TaskItemDropdown from './TaskItemDropdown.vue'
import { formatDurationShort } from '../utils/formatDuration'
import { calculateLiveDuration, isTracking } from '../utils/timeTracking'

interface Props {
  task: Task
  mode?: 'list' | 'kanban' | 'compact'
  projectName?: string
  tick?: number
  draggable?: boolean
  showPriority?: boolean
  forceDropdown?: boolean // 强制使用下拉菜单
  depth?: number // 树形缩进层级
  hasChildren?: boolean // 是否有子任务
  isExpanded?: boolean // 是否已展开
  allTasks?: Task[] // 所有任务列表，用于检查前置任务状态
  hasStatusInconsistency?: boolean // 是否存在状态不一致
  statusSummary?: string // 状态摘要信息
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'list',
  showPriority: false,
  forceDropdown: false,
  depth: 0,
  hasChildren: false,
  isExpanded: false,
  allTasks: () => [],
})

// 检查前置任务是否完成
const hasIncompletePrerequisites = computed(() => {
  if (!props.task.prerequisiteTaskIds || props.task.prerequisiteTaskIds.length === 0) return false
  if (!props.allTasks || props.allTasks.length === 0) return false

  return props.task.prerequisiteTaskIds.some(prereqId => {
    const prereqTask = props.allTasks.find(t => t._id === prereqId)
    if (!prereqTask) return false
    const isCompleted = prereqTask.status === TASK_STATUS.REVIEWING ||
                       prereqTask.status === TASK_STATUS.PLAN_REVIEWING ||
                       prereqTask.status === TASK_STATUS.COMPLETED ||
                       prereqTask.status === TASK_STATUS.CLOSED
    return !isCompleted
  })
})

// 响应式的移动端检测
const isMobile = ref(false)

// 检测是否为移动端
function checkMobile() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 640
}

// 判断是否应该使用下拉菜单
const shouldUseDropdown = computed(() => {
  // 强制使用下拉菜单
  if (props.forceDropdown) return true

  // 紧凑模式和看板模式始终使用下拉菜单
  if (props.mode === 'compact' || props.mode === 'kanban') return true

  // 移动端使用下拉菜单
  if (isMobile.value) return true

  // 桌面端列表模式直接显示按钮
  return false
})

// 下拉菜单状态
const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const showStatusSubmenu = ref(false)
const dropdownStyle = ref({ top: '0px', right: '0px' })

const nextStates = computed(() => getAllowedNext(props.task.status, props.task))

function updateDropdownPosition() {
  const btn = dropdownRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
  }
}

function toggleDropdown(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  showDropdown.value = !showDropdown.value
  showStatusSubmenu.value = false
  if (showDropdown.value) {
    updateDropdownPosition()
  }
}

function closeDropdown() {
  showDropdown.value = false
  showStatusSubmenu.value = false
}

// 点击下拉菜单内部时不关闭
function handleDropdownClick(e: Event) {
  e.stopPropagation()
}

// 点击外部关闭下拉菜单
function handleClickOutside(e: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', checkMobile)
  checkMobile() // 初始检测
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', checkMobile)
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
  toggle: [taskId: string]
  addSubtask: [taskId: string]
  addPostTask: [taskId: string]
}>()

function onStatusTransition(status: TaskStatus) {
  emit('transition', status)
  closeDropdown()
}

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
    <div class="tree-indent" :style="{ width: `${depth * 20}px` }"></div>
    <button
      v-if="hasChildren"
      class="tree-toggle"
      @click.stop="emit('toggle', task._id)"
      title="展开/折叠子任务"
    >
      <span class="tree-toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
    </button>
    <span v-else-if="depth > 0" class="tree-leaf-spacer"></span>
    <div class="task-main">
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="title"
        :class="{ 'title-blocked': hasIncompletePrerequisites }"
        @click="emit('navigate', task._id)"
      >
        <span v-if="hasIncompletePrerequisites" class="prerequisite-warning-icon" title="前置任务未完成">⚠️</span>
        <span v-if="hasStatusInconsistency" class="status-inconsistency-icon" title="父子任务状态不一致">🔄</span>
        {{ task.title }}
        <span v-if="hasStatusInconsistency && statusSummary" class="status-summary" title="子任务状态分布">
          ({{ statusSummary }})
        </span>
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
        <!-- 下拉菜单模式 -->
        <div v-if="shouldUseDropdown" class="dropdown" :class="{ 'dropdown-active': showDropdown }" ref="dropdownRef">
          <button class="glass-button btn-more" @click="toggleDropdown">
            <span class="more-icon">•••</span>
          </button>
          <TaskItemDropdown
            :task="task"
            :show-dropdown="showDropdown"
            :show-status-submenu="showStatusSubmenu"
            :next-states="nextStates"
            :dropdown-style="dropdownStyle"
            @edit="emit('edit', $event); closeDropdown()"
            @transition="onStatusTransition"
            @add-subtask="emit('addSubtask', $event); closeDropdown()"
            @delete="emit('delete', $event); closeDropdown()"
            @toggle-submenu="showStatusSubmenu = $event"
            @close="closeDropdown()"
            @add-post-task="emit('addPostTask', $event); closeDropdown()"
          />
        </div>

        <!-- 直接显示按钮模式 -->
        <template v-else>
          <button class="glass-button btn-edit" @click="emit('edit', task._id)">编辑</button>
          <button class="glass-button danger btn-delete" @click="emit('delete', task._id)">删除</button>
        </template>
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
      <div class="dropdown" :class="{ 'dropdown-active': showDropdown }" ref="dropdownRef">
        <button class="glass-button btn-more" @click="toggleDropdown">
          <span class="more-icon">•••</span>
        </button>
        <TaskItemDropdown
          :task="task"
          :show-dropdown="showDropdown"
          :show-status-submenu="showStatusSubmenu"
          :next-states="nextStates"
          :dropdown-style="dropdownStyle"
          @edit="emit('edit', $event); closeDropdown()"
          @transition="onStatusTransition"
          @add-subtask="emit('addSubtask', $event); closeDropdown()"
          @delete="emit('delete', $event); closeDropdown()"
          @toggle-submenu="showStatusSubmenu = $event"
          @close="closeDropdown()"
          @add-post-task="emit('addPostTask', $event); closeDropdown()"
        />
      </div>
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
    <div class="tree-indent" :style="{ width: `${depth * 16}px` }"></div>
    <button
      v-if="hasChildren"
      class="tree-toggle compact-toggle"
      @click.stop="emit('toggle', task._id)"
      title="展开/折叠子任务"
    >
      <span class="tree-toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
    </button>
    <span v-else-if="depth > 0" class="tree-leaf-spacer compact-spacer"></span>
    <div class="compact-main">
      <RouterLink
        :to="{ name: 'task-detail', params: { id: task._id } }"
        class="compact-title"
        @click="emit('navigate', task._id)"
      >
        <span v-if="hasStatusInconsistency" class="status-inconsistency-icon compact">⚠️</span>
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
      <div class="dropdown" :class="{ 'dropdown-active': showDropdown }" ref="dropdownRef">
        <button class="glass-button btn-icon btn-more" @click="toggleDropdown">
          <span class="more-icon">•••</span>
        </button>
        <TaskItemDropdown
          :task="task"
          :show-dropdown="showDropdown"
          :show-status-submenu="showStatusSubmenu"
          :next-states="nextStates"
          :dropdown-style="dropdownStyle"
          compact
          @edit="emit('edit', $event); closeDropdown()"
          @transition="onStatusTransition"
          @add-subtask="emit('addSubtask', $event); closeDropdown()"
          @delete="emit('delete', $event); closeDropdown()"
          @toggle-submenu="showStatusSubmenu = $event"
          @close="closeDropdown()"
          @add-post-task="emit('addPostTask', $event); closeDropdown()"
        />
      </div>
    </div>
  </li>
</template>

<style scoped>
/* Tree controls */
.tree-indent {
  flex-shrink: 0;
}

.tree-toggle {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  margin-top: 2px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.tree-toggle:hover {
  color: var(--color-accent);
  background: rgba(0, 0, 0, 0.05);
}

.tree-toggle-icon {
  font-size: 0.625rem;
  line-height: 1;
}

.tree-leaf-spacer {
  flex-shrink: 0;
  width: 20px;
}

.tree-leaf-spacer.compact-spacer {
  width: 22px;
}

.tree-toggle.compact-toggle {
  width: 22px;
  height: 22px;
  margin-top: 0;
}

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

.task-list-item .title-blocked {
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.task-list-item .prerequisite-warning-icon {
  margin-right: var(--space-xs);
  font-size: 0.9em;
  animation: pulse 2s infinite;
}

.task-list-item .status-inconsistency-icon {
  margin-right: var(--space-xs);
  font-size: 0.9em;
  animation: rotate 3s linear infinite;
  color: #ff9f0a;
}

.task-list-item .status-summary {
  font-size: 0.8em;
  color: var(--color-text-secondary);
  font-weight: normal;
  margin-left: var(--space-xs);
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

.task-list-item .btn-edit {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--color-text);
}

.task-list-item .btn-edit:hover {
  background: var(--glass-bg-hover);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.task-list-item .btn-delete {
  background: rgba(255, 59, 48, 0.05);
  border: 1px solid rgba(255, 59, 48, 0.2);
  color: var(--color-error);
}

.task-list-item .btn-delete:hover {
  background: rgba(255, 59, 48, 0.1);
  border-color: var(--color-error);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(255, 59, 48, 0.15);
}

/* 下拉菜单样式 */
.task-list-item .dropdown {
  position: relative;
  display: inline-block;
}

.task-list-item .dropdown-active .btn-more {
  background: rgba(0, 0, 0, 0.08);
  border-color: var(--color-accent);
}

.task-list-item .btn-more {
  min-height: 28px;
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-list-item .more-icon {
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 2px;
  line-height: 1;
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

/* Kanban模式下拉菜单 */
.task-kanban-item .dropdown {
  position: relative;
  width: 100%;
}

.task-kanban-item .dropdown-active .btn-more {
  background: rgba(0, 0, 0, 0.08);
  border-color: var(--color-accent);
}

.task-kanban-item .btn-more {
  width: 100%;
  min-height: 24px;
  font-size: 0.75rem;
  padding: 4px var(--space-sm);
}

.task-kanban-item .more-icon {
  font-size: 0.875rem;
  font-weight: bold;
  letter-spacing: 1px;
}

/* Compact mode - 紧凑但可读 */
.task-compact-item {
  padding: 6px 10px;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  transition: background-color var(--transition-fast), transform var(--transition-fast);
  border-radius: var(--radius-sm);
  min-height: 40px;
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
  gap: 6px;
}

.task-compact-item .compact-title {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text);
  text-decoration: none;
  transition: color var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.task-compact-item .compact-title:hover {
  color: var(--color-accent);
}

.task-compact-item .compact-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  flex-shrink: 0;
}

.task-compact-item .compact-meta .kind {
  font-weight: 500;
  background: rgba(0, 0, 0, 0.02);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border-subtle);
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-size: 0.6875rem;
}

.task-compact-item .compact-meta .kind:hover {
  background: rgba(0, 0, 0, 0.04);
}

.task-compact-item .compact-meta .project {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
  font-size: 0.75rem;
}

.task-compact-item .compact-meta .project::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 3px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.5;
  flex-shrink: 0;
}

.task-compact-item .compact-meta .duration {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(0, 0, 0, 0.02);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-size: 0.75rem;
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
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}

.task-compact-item .compact-actions .btn-icon {
  font-size: 0.875rem;
  padding: 4px;
  min-height: 26px;
  min-width: 26px;
  max-width: 26px;
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
  font-size: 0.75rem;
  line-height: 1;
}

/* Compact模式下拉菜单 */
.task-compact-item .dropdown {
  position: relative;
}

.task-compact-item .dropdown-active .btn-more {
  background: rgba(0, 0, 0, 0.06);
  border-color: var(--color-accent);
}

.task-compact-item .btn-more {
  min-height: 22px;
  min-width: 22px;
  max-width: 22px;
  padding: 3px;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-compact-item .more-icon {
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.5px;
  line-height: 1;
}

.task-compact-item .status-inconsistency-icon.compact {
  margin-right: 2px;
  font-size: 0.8em;
  animation: rotate 3s linear infinite;
  color: #ff9f0a;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

  .task-list-item .btn-more {
    min-height: 36px;
    padding: var(--space-sm) var(--space-md);
  }

  .task-list-item .more-icon {
    font-size: 1.125rem;
  }

  .task-kanban-item .card-actions .glass-button {
    min-height: 36px;
    font-size: 0.8125rem;
    padding: var(--space-xs) var(--space-sm);
  }

  /* 优化移动端的紧凑模式 */
  .task-compact-item {
    padding: 5px 8px;
    min-height: 36px;
    gap: 5px;
  }

  .task-compact-item .compact-main {
    flex: 1;
    gap: 4px;
    min-width: 0;
  }

  .task-compact-item .compact-title {
    font-size: 0.8125rem;
    line-height: 1.3;
  }

  .task-compact-item .compact-meta {
    font-size: 0.6875rem;
    gap: 3px;
  }

  .task-compact-item .compact-meta .kind {
    font-size: 0.625rem;
    padding: 2px 5px;
  }

  .task-compact-item .compact-meta .project {
    font-size: 0.6875rem;
    max-width: 60px;
  }

  .task-compact-item .compact-meta .duration {
    font-size: 0.6875rem;
    padding: 2px 5px;
  }

  .task-compact-item .compact-actions {
    gap: 3px;
  }

  .task-compact-item .compact-actions .btn-icon {
    min-height: 24px;
    min-width: 24px;
    max-width: 24px;
    padding: 3px;
  }

  .task-compact-item .compact-actions .btn-icon span {
    font-size: 0.6875rem;
  }

  .task-compact-item .more-icon {
    font-size: 0.75rem;
  }
}
</style>

