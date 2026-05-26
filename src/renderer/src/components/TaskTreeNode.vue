<script setup lang="ts">
import { computed } from 'vue'
import TaskListItem from './TaskListItem.vue'
import type { Task } from '../../../shared/types'
import type { TaskStatus } from '../../../shared/constants'

defineOptions({
  name: 'TaskTreeNode'
})

interface Props {
  task: Task
  allTasks: Task[]
  depth: number
  projectNameMap: Map<string, string>
  tick: number
  mode: 'comfortable' | 'compact'
  expandedIds: Set<string>
  hasStatusInconsistency?: boolean
  statusSummary?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: [taskId: string]
  transition: [taskId: string, status: TaskStatus]
  edit: [taskId: string]
  delete: [taskId: string]
  addSubtask: [taskId: string]
  addPostTask: [taskId: string]
}>()

const children = computed(() => {
  return props.allTasks
    .filter((t) => t.parentTaskId === props.task._id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

const hasChildren = computed(() => children.value.length > 0)
const isExpanded = computed(() => props.expandedIds.has(props.task._id))

function handleTransition(taskId: string, status: TaskStatus) {
  emit('transition', taskId, status)
}
</script>

<template>
  <TaskListItem
    :task="task"
    :mode="mode === 'compact' ? 'compact' : 'list'"
    :project-name="projectNameMap.get(task.projectId) ?? task.projectId"
    :tick="tick"
    :depth="depth"
    :has-children="hasChildren"
    :is-expanded="isExpanded"
    :all-tasks="allTasks"
    :has-status-inconsistency="hasStatusInconsistency"
    :status-summary="statusSummary"
    @toggle="emit('toggle', $event)"
    @transition="emit('transition', task._id, $event)"
    @edit="emit('edit', task._id)"
    @delete="emit('delete', task._id)"
    @add-subtask="emit('addSubtask', task._id)"
    @add-post-task="emit('addPostTask', task._id)"
  />
  <template v-if="hasChildren && isExpanded">
    <TaskTreeNode
      v-for="child in children"
      :key="child._id"
      :task="child"
      :all-tasks="allTasks"
      :depth="depth + 1"
      :project-name-map="projectNameMap"
      :tick="tick"
      :mode="mode"
      :expanded-ids="expandedIds"
      :has-status-inconsistency="children.some(c => c.status !== child.status)"
      :status-summary="children.length > 1 ? '' : undefined"
      @toggle="emit('toggle', $event)"
      @transition="handleTransition"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @add-subtask="emit('addSubtask', $event)"
      @add-post-task="emit('addPostTask', $event)"
    />
  </template>
</template>
