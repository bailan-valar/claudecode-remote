<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="empty glass">
    <span class="empty-icon">◈</span>
    <p>{{ message ?? '暂无数据' }}</p>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.3;
}

.empty p {
  font-size: 0.9375rem;
  font-weight: 500;
}
</style>
