<script setup lang="ts">
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'
import type { Project } from '../../../shared/types'
import { STATUS_LABEL } from '../utils/taskTransitions'

defineProps<{
  projects: Project[]
  selectedProjectId: string | null
  selectedStatus: TaskStatus | null
}>()
const emit = defineEmits<{
  updateProject: [id: string | null]
  updateStatus: [status: TaskStatus | null]
}>()
</script>

<template>
  <div class="filters">
    <select
      :value="selectedProjectId ?? ''"
      @change="emit('updateProject', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">全部项目</option>
      <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
    </select>
    <select
      :value="selectedStatus ?? ''"
      @change="emit('updateStatus', (($event.target as HTMLSelectElement).value as TaskStatus) || null)"
    >
      <option value="">全部状态</option>
      <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
    </select>
  </div>
</template>

<style scoped>
.filters { display: flex; gap: var(--space-sm); }
.filters select { padding: var(--space-sm); font-size: 0.875rem; border-radius: var(--radius); border: 1px solid var(--color-border); }
</style>
