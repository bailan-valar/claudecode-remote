<script setup lang="ts">
import { computed } from 'vue'
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'
import type { Task } from '../../../shared/types'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'
import TaskListItem from './TaskListItem.vue'

const props = defineProps<{
  tasks: Task[]
  projectNameMap: Map<string, string>
  tick?: number
}>()

const emit = defineEmits<{
  move: [taskId: string, status: TaskStatus]
  edit: [taskId: string]
  delete: [taskId: string]
  addSubtask: [taskId: string]
  addPostTask: [taskId: string]
}>()

const statusList = Object.values(TASK_STATUS) as TaskStatus[]

const grouped = computed(() => {
  const map = {} as Record<TaskStatus, Task[]>
  statusList.forEach((s) => {
    const filtered = props.tasks.filter((t) => t.status === s)
    // Sort by updatedAt in descending order (most recent first)
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    map[s] = filtered
  })
  return map
})

function onDragStart(e: DragEvent, taskId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }
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
        <TaskListItem
          v-for="task in grouped[status]"
          :key="task._id"
          mode="kanban"
          :task="task"
          :project-name="projectNameMap.get(task.projectId) ?? task.projectId"
          :tick="tick"
          :draggable="true"
          :all-tasks="tasks"
          @dragstart="onDragStart"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
          @add-subtask="emit('addSubtask', $event)"
          @add-post-task="emit('addPostTask', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban {
  display: flex;
  gap: var(--space-sm);
  overflow-x: auto;
  padding-bottom: var(--space-sm);
  min-height: 400px;
}

.kanban-column {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}

.kanban-column.drag-over {
  background: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 2px var(--color-accent);
}

.column-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  font-weight: 600;
  font-size: 0.8125rem;
  padding-bottom: var(--space-xs);
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
  gap: var(--space-sm);
  overflow-y: auto;
  flex: 1;
}

@media (max-width: 640px) {
  .kanban {
    gap: var(--space-xs);
  }
  .kanban-column {
    flex: 0 0 220px;
    padding: var(--space-xs);
  }
}
</style>
