<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTaskStore } from '../stores/useTaskStore'
import type { Project, Task } from '../../../shared/types'
import { TASK_STATUS, TASK_KIND, KIND_LABEL } from '../../../shared/constants'
import { STATUS_LABEL } from '../utils/taskTransitions'

const props = defineProps<{
  projects: Project[]
  tasks?: Task[]
  initialTask?: Task
  mode?: 'create' | 'edit'
  defaultProjectId?: string
  defaultParentTaskId?: string
}>()
const emit = defineEmits<{
  submit: [changes?: Partial<Task>]
  cancel: []
}>()
const taskStore = useTaskStore()

const title = ref('')
const description = ref('')
const projectId = ref('')
const parentTaskId = ref<string | null>(null)
const status = ref<Task['status']>('pending')
const kind = ref<Task['kind']>('task')
const isPlan = ref(false)

const isEdit = computed(() => props.mode === 'edit')

const eligibleParentTasks = computed(() => {
  if (!projectId.value) return []
  return (props.tasks ?? []).filter((t) =>
    t.projectId === projectId.value &&
    t._id !== props.initialTask?._id &&
    !t.parentTaskId
  )
})

watch(() => props.initialTask, (t) => {
  if (t) {
    title.value = t.title
    description.value = t.description ?? ''
    projectId.value = t.projectId
    parentTaskId.value = t.parentTaskId ?? null
    status.value = t.status
    kind.value = t.kind ?? 'task'
    isPlan.value = t.isPlan ?? false
  } else if (props.defaultProjectId) {
    projectId.value = props.defaultProjectId
    if (props.defaultParentTaskId) {
      parentTaskId.value = props.defaultParentTaskId
    }
  }
}, { immediate: true })

watch(kind, (newKind, oldKind) => {
  if (!isEdit.value && newKind === 'epic' && oldKind !== 'epic') {
    // 仅在从非史诗切换到史诗时，默认勾选 plan
    isPlan.value = true
  }
})

watch(isPlan, (val) => {
  if (!isEdit.value) {
    status.value = val ? 'plan_required' : 'pending'
  }
})

async function handleSubmit() {
  if (isEdit.value) {
    const changes: Partial<Task> = {}
    if (title.value !== props.initialTask!.title) changes.title = title.value
    if (description.value !== (props.initialTask!.description ?? '')) changes.description = description.value || undefined
    if (projectId.value !== props.initialTask!.projectId) changes.projectId = projectId.value
    if (parentTaskId.value !== props.initialTask!.parentTaskId) changes.parentTaskId = parentTaskId.value
    if (status.value !== props.initialTask!.status) changes.status = status.value
    if (kind.value !== (props.initialTask!.kind ?? 'task')) changes.kind = kind.value
    if (isPlan.value !== (props.initialTask!.isPlan ?? false)) changes.isPlan = isPlan.value
    emit('submit', changes)
    return
  }
  const result = await taskStore.create({
    title: title.value,
    description: description.value || undefined,
    projectId: projectId.value,
    parentTaskId: parentTaskId.value ?? undefined,
    status: status.value,
    kind: kind.value,
    isPlan: isPlan.value,
  })
  if (result.ok) {
    title.value = ''
    description.value = ''
    projectId.value = ''
    parentTaskId.value = null
    status.value = 'pending'
    kind.value = 'task'
    isPlan.value = false
    emit('submit')
  }
}
</script>

<template>
  <form class="task-form" @submit.prevent="handleSubmit">
    <div class="form-group">
      <label class="form-label">任务标题 *</label>
      <input v-model="title" class="glass-input" placeholder="请输入任务标题" required />
    </div>

    <div v-if="!props.defaultProjectId" class="form-group">
      <label class="form-label">所属项目 *</label>
      <select v-model="projectId" class="glass-input" required>
        <option value="" disabled>请选择项目</option>
        <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
      </select>
    </div>

    <div v-if="eligibleParentTasks.length" class="form-group">
      <label class="form-label">父任务</label>
      <select v-model="parentTaskId" class="glass-input">
        <option :value="null">无父任务</option>
        <option v-for="t in eligibleParentTasks" :key="t._id" :value="t._id">{{ t.title }}</option>
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">任务状态 *</label>
        <select v-model="status" class="glass-input" required>
          <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">任务类型 *</label>
        <select v-model="kind" class="glass-input" required>
          <option v-for="k in Object.values(TASK_KIND)" :key="k" :value="k">{{ KIND_LABEL[k] }}</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="plan-check">
        <input v-model="isPlan" type="checkbox" />
        <span>需要编写开发计划</span>
      </label>
    </div>

    <div class="form-group">
      <label class="form-label">任务描述</label>
      <textarea v-model="description" class="glass-input" placeholder="请输入任务描述（可选）" rows="3" />
    </div>

    <div class="actions">
      <button type="submit" class="glass-button primary">{{ isEdit ? '保存' : '创建' }}</button>
      <button type="button" class="glass-button" @click="emit('cancel')">取消</button>
    </div>
  </form>
</template>

<style scoped>
.task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.glass-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.9375rem;
  line-height: 1.5;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.glass-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.glass-input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  justify-content: flex-end;
}

.plan-check {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.plan-check input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-accent);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: var(--space-md);
  }

  .actions {
    flex-direction: column;
    gap: var(--space-sm);
  }

  .actions .glass-button {
    width: 100%;
  }
}
</style>
