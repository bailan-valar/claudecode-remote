<script setup lang="ts">
import { ref, computed } from 'vue'
import TaskTreeNode from './TaskTreeNode.vue'
import type { Task } from '../../../shared/types'
import type { TaskStatus } from '../../../shared/constants'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

interface Props {
  tasks: Task[]
  projectNameMap: Map<string, string>
  tick: number
  mode?: 'comfortable' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'comfortable'
})

const emit = defineEmits<{
  transition: [taskId: string, status: TaskStatus]
  edit: [taskId: string]
  delete: [taskId: string]
  addSubtask: [taskId: string]
  addPostTask: [taskId: string]
}>()

// 状态展示顺序
const STATUS_ORDER: TaskStatus[] = [
  'planned',
  'plan_required',
  'planning',
  'plan_reviewing',
  'pending',
  'developing',
  'reviewing',
  'completed',
  'closed',
  'stopped',
  'failed'
]

// 任务展开状态
const expandedIds = ref(new Set<string>())

// 分组折叠状态
const collapsedGroups = ref(new Set<TaskStatus>())

function toggleExpand(taskId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(taskId)) {
    next.delete(taskId)
  } else {
    next.add(taskId)
  }
  expandedIds.value = next
}

function toggleGroup(status: TaskStatus) {
  const next = new Set(collapsedGroups.value)
  if (next.has(status)) {
    next.delete(status)
  } else {
    next.add(status)
  }
  collapsedGroups.value = next
}

// 计算任务树的综合状态，考虑子任务状态
function getTreeStatus(task: Task, allTasks: Task[]): TaskStatus {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)

  if (children.length === 0) {
    return task.status
  }

  // 递归检查所有子任务
  const childStatuses = children.map(child => getTreeStatus(child, allTasks))

  // 如果有子任务状态与当前任务不同，则需要特殊处理
  const hasDifferentStatus = childStatuses.some(status => status !== task.status)

  if (hasDifferentStatus) {
    // 优先级规则：
    // 1. 如果有失败/停止的子任务，显示为警告状态
    if (childStatuses.includes('failed')) return 'failed'
    if (childStatuses.includes('stopped')) return 'stopped'

    // 2. 如果所有子任务都已完成，但父任务不是，显示为进行中
    if (childStatuses.every(s => s === 'completed' || s === 'closed')) {
      return 'developing' // 表示正在进行最后的整合
    }

    // 3. 如果有活跃的子任务，显示最活跃的状态
    const activeStatuses: TaskStatus[] = ['developing', 'planning', 'reviewing', 'plan_reviewing']
    const hasActiveChild = childStatuses.some(s => activeStatuses.includes(s))
    if (hasActiveChild) {
      // 找到最活跃的子任务状态
      for (const activeStatus of activeStatuses) {
        if (childStatuses.includes(activeStatus)) {
          return activeStatus
        }
      }
    }
  }

  return task.status
}

// 检查任务树中是否存在状态不一致
function hasStatusInconsistency(task: Task, allTasks: Task[]): boolean {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)

  if (children.length === 0) return false

  // 检查直接子任务的状态是否与父任务一致
  const directChildrenHaveDifferentStatus = children.some(
    child => child.status !== task.status
  )

  if (directChildrenHaveDifferentStatus) return true

  // 递归检查子任务树
  return children.some(child => hasStatusInconsistency(child, allTasks))
}

// 获取任务树的状态摘要（用于显示）
function getStatusSummary(task: Task, allTasks: Task[]): string {
  const descendants = getAllDescendants(task, allTasks)
  if (descendants.length === 0) return ''

  // 统计各状态的数量
  const statusCounts = new Map<TaskStatus, number>()
  descendants.forEach(descendant => {
    statusCounts.set(descendant.status, (statusCounts.get(descendant.status) || 0) + 1)
  })

  // 生成摘要文本
  const summaryParts: string[] = []
  statusCounts.forEach((count, status) => {
    summaryParts.push(`${STATUS_LABEL[status]} ${count}`)
  })

  return summaryParts.join(', ')
}

// 获取所有后代任务
function getAllDescendants(task: Task, allTasks: Task[]): Task[] {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)
  const descendants = [...children]

  children.forEach(child => {
    descendants.push(...getAllDescendants(child, allTasks))
  })

  return descendants
}

const groupedRoots = computed(() => {
  // 先找出所有顶层任务（没有 parentTaskId 的）
  const rootTasks = props.tasks.filter((t) => !t.parentTaskId)

  // 按状态分组 - 使用树的综合状态
  const groups = new Map<TaskStatus, Task[]>()
  STATUS_ORDER.forEach((s) => groups.set(s, []))

  rootTasks.forEach((t) => {
    // 使用树的综合状态进行分组
    const treeStatus = getTreeStatus(t, props.tasks)
    const list = groups.get(treeStatus)
    if (list) {
      list.push(t)
    } else {
      // 未知状态，放入最后一个组或忽略
      groups.set(treeStatus, [t])
    }
  })

  // 组内按 updatedAt 降序
  groups.forEach((list) => {
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  return STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    color: STATUS_COLOR[status],
    tasks: groups.get(status) ?? []
  })).filter((g) => g.tasks.length > 0)
})

const totalTaskCount = computed(() => props.tasks.length)

function handleTransition(taskId: string, status: TaskStatus) {
  emit('transition', taskId, status)
}
</script>

<template>
  <div class="task-tree-list">
    <div class="tree-summary">共 {{ totalTaskCount }} 个任务</div>
    <div
      v-for="group in groupedRoots"
      :key="group.status"
      class="status-group"
    >
      <button
        class="group-header"
        :class="{ collapsed: collapsedGroups.has(group.status) }"
        @click="toggleGroup(group.status)"
      >
        <span class="group-toggle-icon">
          {{ collapsedGroups.has(group.status) ? '▶' : '▼' }}
        </span>
        <span
          class="group-badge"
          :style="{
            backgroundColor: group.color + '18',
            color: group.color,
            borderColor: group.color + '30',
          }"
        >
          {{ group.label }}
        </span>
        <span class="group-count">{{ group.tasks.length }}</span>
      </button>
      <div v-show="!collapsedGroups.has(group.status)" class="group-body">
        <ul class="group-task-list">
          <TaskTreeNode
            v-for="task in group.tasks"
            :key="task._id"
            :task="task"
            :all-tasks="tasks"
            :depth="0"
            :project-name-map="projectNameMap"
            :tick="tick"
            :mode="mode"
            :expanded-ids="expandedIds"
            :has-status-inconsistency="hasStatusInconsistency(task, tasks)"
            :status-summary="getStatusSummary(task, tasks)"
            @toggle="toggleExpand"
            @transition="handleTransition"
            @edit="emit('edit', $event)"
            @delete="emit('delete', $event)"
            @add-subtask="emit('addSubtask', $event)"
            @add-post-task="emit('addPostTask', $event)"
          />
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-tree-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.tree-summary {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  padding: 0 var(--space-sm);
}

.status-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 1rem;
  color: var(--color-text);
}

.group-header:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.group-header.collapsed {
  opacity: 0.85;
}

.group-toggle-icon {
  font-size: 0.625rem;
  color: var(--color-text-secondary);
  width: 16px;
  text-align: center;
  transition: transform var(--transition-fast);
}

.group-badge {
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.group-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-left: auto;
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  min-width: 28px;
  text-align: center;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.group-task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

@media (max-width: 640px) {
  .group-header {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.9375rem;
  }

  .group-badge {
    font-size: 0.8125rem;
    padding: 2px 8px;
  }

  .group-count {
    font-size: 0.8125rem;
  }

  .tree-summary {
    font-size: 0.8125rem;
  }
}
</style>
