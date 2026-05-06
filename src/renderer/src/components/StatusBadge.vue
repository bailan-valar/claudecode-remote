<script setup lang="ts">
import type { TaskStatus } from '../../../shared/constants'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

defineProps<{ status: TaskStatus }>()
</script>

<template>
  <span class="badge" :style="{ backgroundColor: STATUS_COLOR[status] + '20', color: STATUS_COLOR[status] }">
    {{ STATUS_LABEL[status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  white-space: nowrap;
}
</style>
