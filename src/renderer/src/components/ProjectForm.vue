<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'

const emit = defineEmits<{ submit: []; cancel: [] }>()
const projectStore = useProjectStore()

const name = ref('')
const path = ref('')
const description = ref('')

async function handleSubmit() {
  const result = await projectStore.create({
    name: name.value,
    path: path.value,
    description: description.value || undefined,
  })
  if (result.ok) {
    name.value = ''
    path.value = ''
    description.value = ''
    emit('submit')
  }
}
</script>

<template>
  <form class="project-form" @submit.prevent="handleSubmit">
    <input v-model="name" placeholder="项目名称" required />
    <input v-model="path" placeholder="本地路径（如 /path/to/project）" required />
    <textarea v-model="description" placeholder="描述（可选）" rows="2" />
    <div class="actions">
      <button type="submit">创建</button>
      <button type="button" @click="emit('cancel')">取消</button>
    </div>
  </form>
</template>

<style scoped>
.project-form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.project-form input, .project-form textarea { padding: 0.5rem; font-size: 1rem; }
.actions { display: flex; gap: 0.5rem; }
</style>
