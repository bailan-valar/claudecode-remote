<script setup lang="ts">
import type { TaskStatus } from '../../../shared/constants'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

interface Props {
  status: TaskStatus
  size?: 'normal' | 'small'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'normal'
})
</script>

<template>
  <span
    class="badge"
    :class="{ 'badge-small': size === 'small' }"
    :style="{
      backgroundColor: STATUS_COLOR[status] + '18',
      color: STATUS_COLOR[status],
      borderColor: STATUS_COLOR[status] + '30',
    }"
  >
    {{ STATUS_LABEL[status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.badge-small {
  font-size: 0.625rem;
  padding: 1px 4px;
}
</style>
