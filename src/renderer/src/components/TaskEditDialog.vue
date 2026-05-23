<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import TaskForm from './TaskForm.vue'
import type { Task, Project } from '../../../shared/types'

const props = defineProps<{
  task?: Task
  projects: Project[]
  tasks?: Task[]
  mode?: 'create' | 'edit'
  defaultProjectId?: string
  visible: boolean
}>()

const emit = defineEmits<{
  submit: [task?: Task, changes?: Partial<Task>]
  cancel: []
}>()

const isEditing = ref(false)

const eligibleParentTasks = computed(() => {
  if (!props.defaultProjectId && !props.task) return []
  const currentProjectId = props.defaultProjectId || props.task?.projectId || ''
  return (props.tasks ?? []).filter((t) =>
    t.projectId === currentProjectId &&
    t._id !== props.task?._id &&
    !t.parentTaskId
  )
})

watch(() => props.visible, (newVal) => {
  isEditing.value = newVal
})

function handleSubmit(changes?: Partial<Task>) {
  if (props.mode === 'create') {
    emit('submit', undefined, changes)
  } else {
    emit('submit', props.task, changes)
  }
  isEditing.value = false
}

function handleCancel() {
  emit('cancel')
  isEditing.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="handleCancel">
      <div class="dialog glass-strong">
        <div class="dialog-header">
          <h3>{{ mode === 'create' ? '新建任务' : '编辑任务' }}</h3>
          <button class="close-button" @click="handleCancel">
            <span class="close-icon">×</span>
          </button>
        </div>

        <div class="dialog-content">
          <TaskForm
            :projects="projects"
            :tasks="eligibleParentTasks"
            :initial-task="task"
            :mode="mode"
            :default-project-id="defaultProjectId"
            @submit="handleSubmit"
            @cancel="handleCancel"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.2s ease;
  padding: var(--space-md);
}

.dialog {
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg) var(--space-xl) var(--space-md);
  border-bottom: 1px solid var(--glass-border);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

.close-icon {
  font-size: 1.5rem;
  line-height: 1;
  display: block;
}

.dialog-content {
  padding: var(--space-lg) var(--space-xl);
  overflow-y: auto;
  flex: 1;
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
  .dialog {
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }

  .dialog-header {
    padding: var(--space-md) var(--space-lg) var(--space-sm);
  }

  .dialog-content {
    padding: var(--space-md) var(--space-lg);
  }

  .overlay {
    padding: 0;
    align-items: flex-end;
  }

  .dialog {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 85vh;
  }
}
</style>