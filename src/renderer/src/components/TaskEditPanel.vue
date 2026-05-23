<script setup lang="ts">
import { ref, watch } from 'vue'
import TaskForm from './TaskForm.vue'
import type { Task, Project } from '../../../shared/types'

const props = defineProps<{
  task: Task
  projects: Project[]
}>()

const emit = defineEmits<{
  submit: [changes: Partial<Task>]
}>()

const isEditing = defineModel<boolean>('editing', { default: false })

watch(() => props.task._rev, () => {
  isEditing.value = false
})

function handleSubmit(changes?: Partial<Task>) {
  if (changes && Object.keys(changes).length > 0) {
    emit('submit', changes)
  } else {
    isEditing.value = false
  }
}
</script>

<template>
  <div v-if="isEditing" class="task-edit-panel form-panel glass">
    <TaskForm
      :projects="projects"
      :initial-task="task"
      mode="edit"
      @submit="handleSubmit"
      @cancel="isEditing = false"
    />
  </div>
</template>

<style scoped>
.task-edit-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
</style>
