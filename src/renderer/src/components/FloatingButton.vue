<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const emit = defineEmits<{
  click: []
}>()

// 全局显示悬浮按钮
const isVisible = computed(() => {
  return true // 在所有页面都显示
})

const buttonLabel = computed(() => {
  // 根据不同页面显示不同的按钮文本
  if (route.path === '/tasks') return '新建任务'
  if (route.path.startsWith('/projects/')) return '添加任务'
  if (route.path === '/settings') return '设置'
  return '新增' // 默认文本
})
</script>

<template>
  <Teleport to="body">
    <button
      v-if="isVisible"
      class="floating-button glass-strong"
      :title="buttonLabel"
      @click="emit('click')"
    >
      <span class="plus-icon">+</span>
    </button>
  </Teleport>
</template>

<style scoped>
.floating-button {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.floating-button:hover {
  transform: scale(1.1);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.floating-button:active {
  transform: scale(0.95);
}

.plus-icon {
  font-size: 2rem;
  font-weight: 300;
  color: var(--color-accent);
  line-height: 1;
}

@media (max-width: 768px) {
  .floating-button {
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
  }

  .plus-icon {
    font-size: 1.75rem;
  }

  /* 在移动端有底部导航时，需要调整位置 */
  .app.mobile .floating-button {
    bottom: 88px;
  }
}

@media (max-width: 480px) {
  .floating-button {
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
  }

  .plus-icon {
    font-size: 1.5rem;
  }
}
</style>