<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '../../../shared/constants'
import { getAllowedNext, TRANSITION_LABEL } from '../utils/taskTransitions'

const props = defineProps<{
  status: TaskStatus
  disabled?: boolean
  task?: { isPlan?: boolean }
}>()
const emit = defineEmits<{ transition: [status: TaskStatus] }>()

const nextStates = computed(() => getAllowedNext(props.status, props.task))
</script>

<template>
  <div class="actions">
    <button
      v-for="s in nextStates"
      :key="s"
      class="glass-button primary"
      :disabled="disabled"
      @click="emit('transition', s)"
    >
      {{ TRANSITION_LABEL[s] || s }}
    </button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.glass-button.primary {
  min-height: 36px;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.glass-button.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0, 113, 227, 0.3);
}

.glass-button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 640px) {
  .glass-button.primary {
    min-height: 44px;
    font-size: 1rem;
  }
}
</style>
