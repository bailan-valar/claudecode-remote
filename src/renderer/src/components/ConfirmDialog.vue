<script setup lang="ts">
defineProps<{ title: string; message: string; visible: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="emit('cancel')">
      <div class="dialog glass-strong">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="actions">
          <button class="glass-button danger" @click="emit('confirm')">确认</button>
          <button class="glass-button" @click="emit('cancel')">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fadeIn 0.2s ease;
}

.dialog {
  padding: var(--space-xl);
  min-width: 340px;
  max-width: 90vw;
  animation: scaleIn 0.2s ease;
}

.dialog h3 {
  margin-bottom: var(--space-sm);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.dialog p {
  margin-bottom: var(--space-xl);
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
