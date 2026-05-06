<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '../../../shared/constants'
import { getAllowedNext, TRANSITION_LABEL } from '../utils/taskTransitions'

const props = defineProps<{ status: TaskStatus; disabled?: boolean }>()
const emit = defineEmits<{ transition: [status: TaskStatus] }>()

const nextStates = computed(() => getAllowedNext(props.status))
</script>

<template>
  <div class="actions">
    <button
      v-for="s in nextStates"
      :key="s"
      class="btn-primary"
      :disabled="disabled"
      @click="emit('transition', s)"
    >
      {{ TRANSITION_LABEL[s] || s }}
    </button>
  </div>
</template>

<style scoped>
.actions { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
.btn-primary {
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius);
  background: var(--color-accent);
  color: white;
  font-size: 0.875rem;
  transition: opacity 0.2s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
