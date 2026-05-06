<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="empty">
    <p>{{ message ?? '暂无数据' }}</p>
  </div>
</template>

<style scoped>
.empty {
  text-align: center; padding: var(--space-xl); color: var(--color-muted);
}
</style>
