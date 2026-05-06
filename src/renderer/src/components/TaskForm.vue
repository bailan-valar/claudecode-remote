<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '../stores/useTaskStore'
import type { Project } from '../../../shared/types'

const props = defineProps<{ projects: Project[] }>()
const emit = defineEmits<{ submit: []; cancel: [] }>()
const taskStore = useTaskStore()

const title = ref('')
const description = ref('')
const prompt = ref('')
const projectId = ref('')

async function handleSubmit() {
  const result = await taskStore.create({
    title: title.value,
    description: description.value || undefined,
    prompt: prompt.value,
    projectId: projectId.value,
  })
  if (result.ok) {
    title.value = ''
    description.value = ''
    prompt.value = ''
    projectId.value = ''
    emit('submit')
  }
}
</script>

<template>
  <form class="task-form" @submit.prevent="handleSubmit">
    <input v-model="title" placeholder="任务标题" required />
    <select v-model="projectId" required>
      <option value="" disabled>选择项目</option>
      <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
    </select>
    <textarea v-model="description" placeholder="描述（可选）" rows="2" />
    <textarea v-model="prompt" placeholder="给 Claude Code 的 Prompt" rows="4" required />
    <div class="actions">
      <button type="submit">创建</button>
      <button type="button" @click="emit('cancel')">取消</button>
    </div>
  </form>
</template>

<style scoped>
.task-form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.task-form input, .task-form textarea, .task-form select { padding: 0.5rem; font-size: 1rem; }
.actions { display: flex; gap: 0.5rem; }
</style>
