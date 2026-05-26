<script setup lang="ts">
import { ref, computed } from 'vue'
import TaskForm from './TaskForm.vue'
import type { Project, Task } from '../../../shared/types'

const props = defineProps<{
  projects: Project[]
  tasks?: Task[]
  defaultProjectId?: string
  defaultParentTaskId?: string
  defaultPrerequisiteTaskIds?: string[]
  title?: string
}>()

const dialogTitle = computed(() => props.title || '新建任务')

const emit = defineEmits<{
  submit: [changes?: Partial<Task>]
  cancel: []
}>()

const isVisible = defineModel<boolean>('visible', { default: false })

function handleSubmit(changes?: Partial<Task>) {
  emit('submit', changes)
  isVisible.value = false
}

function handleCancel() {
  emit('cancel')
  isVisible.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isVisible" class="task-create-overlay" @click.self="handleCancel">
      <div class="task-create-dialog glass-strong">
        <div class="dialog-header">
          <h2>{{ dialogTitle }}</h2>
          <button class="close-button" @click="handleCancel">✕</button>
        </div>
        <div class="dialog-body">
          <TaskForm
            :projects="projects"
            :tasks="tasks"
            mode="create"
            :default-project-id="defaultProjectId"
            :default-parent-task-id="defaultParentTaskId"
            :default-prerequisite-task-ids="defaultPrerequisiteTaskIds"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.task-create-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  animation: fadeIn 0.2s ease;
  padding: var(--space-lg);
}

.task-create-dialog {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1.5rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-text);
}

.dialog-body {
  padding: var(--space-lg);
  overflow-y: auto;
  max-height: calc(90vh - 80px);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 640px) {
  .task-create-overlay {
    padding: var(--space-md);
  }

  .task-create-dialog {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .dialog-header {
    padding: var(--space-md);
  }

  .dialog-body {
    padding: var(--space-md);
    max-height: calc(100vh - 70px);
  }
}
</style>
