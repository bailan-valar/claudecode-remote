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
const prompt = ref('')
const projectId = ref('')
const parentTaskId = ref<string | null>(null)
const status = ref<Task['status']>('planned')
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
    prompt.value = t.prompt ?? ''
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
    status.value = val ? 'plan_required' : 'planned'
  }
})

async function handleSubmit() {
  if (isEdit.value) {
    const changes: Partial<Task> = {}
    if (title.value !== props.initialTask!.title) changes.title = title.value
    if (description.value !== (props.initialTask!.description ?? '')) changes.description = description.value || undefined
    if (prompt.value !== (props.initialTask!.prompt ?? '')) changes.prompt = prompt.value || undefined
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
    prompt: prompt.value || title.value,
    projectId: projectId.value,
    parentTaskId: parentTaskId.value ?? undefined,
    status: status.value,
    kind: kind.value,
    isPlan: isPlan.value,
  })
  if (result.ok) {
    title.value = ''
    description.value = ''
    prompt.value = ''
    projectId.value = ''
    parentTaskId.value = null
    status.value = 'planned'
    kind.value = 'task'
    isPlan.value = false
    emit('submit')
  }
}
</script>

<template>
  <form class="task-form" @submit.prevent="handleSubmit">
    <input v-model="title" class="glass-input" placeholder="任务标题" required />
    <select v-if="!props.defaultProjectId" v-model="projectId" class="glass-input" required>
      <option value="" disabled>选择项目</option>
      <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
    </select>
    <select v-if="eligibleParentTasks.length" v-model="parentTaskId" class="glass-input">
      <option :value="null">无父任务</option>
      <option v-for="t in eligibleParentTasks" :key="t._id" :value="t._id">{{ t.title }}</option>
    </select>
    <select v-model="status" class="glass-input" required>
      <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
    </select>
    <label class="plan-check">
      <input v-model="isPlan" type="checkbox" />
      <span>需要编写开发计划</span>
    </label>
    <select v-model="kind" class="glass-input" required>
      <option v-for="k in Object.values(TASK_KIND)" :key="k" :value="k">{{ KIND_LABEL[k] }}</option>
    </select>
    <textarea v-model="description" class="glass-input" placeholder="描述（可选）" rows="2" />
    <textarea v-model="prompt" class="glass-input" placeholder="给 Claude Code 的 Prompt（可选，执行时默认使用标题）" rows="4" />
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
  gap: var(--space-md);
}

.actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.plan-check {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
}

.plan-check input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
</style>
