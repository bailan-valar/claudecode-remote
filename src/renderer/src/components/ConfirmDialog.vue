<script setup lang="ts">
defineProps<{ title: string; message: string; visible: boolean }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="emit('cancel')">
      <div class="dialog">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="actions">
          <button class="btn-danger" @click="emit('confirm')">确认</button>
          <button class="btn-secondary" @click="emit('cancel')">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.dialog {
  background: var(--color-surface); border-radius: var(--radius);
  padding: var(--space-lg); min-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.dialog h3 { margin-bottom: var(--space-sm); font-size: 1rem; }
.dialog p { margin-bottom: var(--space-lg); color: var(--color-muted); font-size: 0.875rem; }
.actions { display: flex; gap: var(--space-sm); justify-content: flex-end; }
.btn-danger { padding: var(--space-sm) var(--space-md); border: none; border-radius: var(--radius); background: var(--color-error); color: white; font-size: 0.875rem; }
.btn-secondary { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.875rem; }
</style>
