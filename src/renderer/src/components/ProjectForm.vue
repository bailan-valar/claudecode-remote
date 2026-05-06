<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'
import type { Project } from '../../../shared/types'

const props = defineProps<{
  initialProject?: Project
  mode?: 'create' | 'edit'
}>()
const emit = defineEmits<{
  submit: [changes?: Partial<Project>]
  cancel: []
}>()
const projectStore = useProjectStore()

const name = ref('')
const path = ref('')
const description = ref('')

const isEdit = computed(() => props.mode === 'edit')

watch(() => props.initialProject, (p) => {
  if (p) {
    name.value = p.name
    path.value = p.path
    description.value = p.description ?? ''
  }
}, { immediate: true })

async function handleSelectDirectory() {
  const result = await window.api.selectDirectory()
  if (result.ok && result.path) {
    path.value = result.path
  }
}

async function handleSubmit() {
  if (isEdit.value) {
    const changes: Partial<Project> = {}
    if (name.value !== props.initialProject!.name) changes.name = name.value
    if (path.value !== props.initialProject!.path) changes.path = path.value
    if (description.value !== (props.initialProject!.description ?? '')) changes.description = description.value || undefined
    emit('submit', changes)
    return
  }
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
    <div class="path-input">
      <input v-model="path" placeholder="本地路径" required readonly />
      <button type="button" @click="handleSelectDirectory">选择文件夹</button>
    </div>
    <textarea v-model="description" placeholder="描述（可选）" rows="2" />
    <div class="actions">
      <button type="submit">{{ isEdit ? '保存' : '创建' }}</button>
      <button type="button" @click="emit('cancel')">取消</button>
    </div>
  </form>
</template>

<style scoped>
.project-form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.project-form input, .project-form textarea { padding: 0.5rem; font-size: 1rem; }
.path-input { display: flex; gap: 0.5rem; }
.path-input input { flex: 1; }
.actions { display: flex; gap: 0.5rem; }
</style>
