<script setup lang="ts">
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'
import type { Project } from '../../../shared/types'
import { STATUS_LABEL } from '../utils/taskTransitions'

defineProps<{
  projects: Project[]
  selectedProjectId: string | null
  selectedStatus: TaskStatus | null
  hideStatus?: boolean
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
      class="glass-input"
      @change="emit('updateProject', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">全部项目</option>
      <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
    </select>
    <select
      v-if="!hideStatus"
      :value="selectedStatus ?? ''"
      class="glass-input"
      @change="emit('updateStatus', (($event.target as HTMLSelectElement).value as TaskStatus) || null)"
    >
      <option value="">全部状态</option>
      <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
    </select>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.filters .glass-input {
  width: auto;
  min-width: 140px;
}
</style>
