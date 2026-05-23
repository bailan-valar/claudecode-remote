<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  submit: [data: { title: string; description?: string }]
  cancel: []
}>()

const title = ref('')
const description = ref('')

const canSubmit = computed(() => !!title.value.trim())

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit', {
    title: title.value.trim(),
    description: description.value.trim() || undefined,
  })
  title.value = ''
  description.value = ''
}

function handleCancel() {
  title.value = ''
  description.value = ''
  emit('cancel')
}
</script>

<template>
  <div class="task-subtask-panel">
    <h3 class="panel-title">新增子任务</h3>
    <p class="panel-hint">子任务将与父任务共用同一个 Claude Session 继续执行。</p>
    <input
      v-model="title"
      class="glass-input"
      placeholder="子任务标题"
      required
    />
    <textarea
      v-model="description"
      class="glass-input"
      placeholder="子任务描述（可选）"
      rows="4"
    />
    <div class="panel-actions">
      <button
        class="glass-button primary"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        创建子任务
      </button>
      <button class="glass-button" @click="handleCancel">取消</button>
    </div>
  </div>
</template>

<style scoped>
.task-subtask-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.panel-hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.panel-actions {
  display: flex;
  gap: var(--space-sm);
}
</style>
