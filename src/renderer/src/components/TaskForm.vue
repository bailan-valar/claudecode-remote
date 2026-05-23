<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTaskStore } from '../stores/useTaskStore'
import type { Project, Task } from '../../../shared/types'

const props = defineProps<{
  projects: Project[]
  tasks?: Task[]
  initialTask?: Task
  mode?: 'create' | 'edit'
  defaultProjectId?: string
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
    prompt.value = t.prompt
    projectId.value = t.projectId
    parentTaskId.value = t.parentTaskId ?? null
  } else if (props.defaultProjectId) {
    projectId.value = props.defaultProjectId
  }
}, { immediate: true })

async function handleSubmit() {
  if (isEdit.value) {
    const changes: Partial<Task> = {}
    if (title.value !== props.initialTask!.title) changes.title = title.value
    if (description.value !== (props.initialTask!.description ?? '')) changes.description = description.value || undefined
    if (prompt.value !== props.initialTask!.prompt) changes.prompt = prompt.value
    if (projectId.value !== props.initialTask!.projectId) changes.projectId = projectId.value
    if (parentTaskId.value !== props.initialTask!.parentTaskId) changes.parentTaskId = parentTaskId.value
    emit('submit', changes)
    return
  }
  const result = await taskStore.create({
    title: title.value,
    description: description.value || undefined,
    prompt: prompt.value || title.value,
    projectId: projectId.value,
    parentTaskId: parentTaskId.value ?? undefined,
  })
  if (result.ok) {
    title.value = ''
    description.value = ''
    prompt.value = ''
    projectId.value = ''
    parentTaskId.value = null
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
    <textarea v-model="description" class="glass-input" placeholder="描述（可选）" rows="2" />
    <textarea v-model="prompt" class="glass-input" placeholder="给 Claude Code 的 Prompt" rows="4" required />
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
</style>
