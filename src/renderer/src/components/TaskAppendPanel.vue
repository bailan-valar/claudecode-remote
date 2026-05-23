<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  submit: [content: string]
  cancel: []
}>()

const content = ref('')

const canSubmit = computed(() => !!content.value.trim())

function handleSubmit() {
  const trimmed = content.value.trim()
  if (!trimmed) return
  emit('submit', trimmed)
  content.value = ''
}

function handleCancel() {
  content.value = ''
  emit('cancel')
}
</script>

<template>
  <div class="task-append-panel">
    <h3 class="panel-title">追加任务内容</h3>
    <p class="panel-hint">以下内容将追加到当前任务的 Prompt 末尾，并重新提交执行。</p>
    <textarea
      v-model="content"
      class="glass-input"
      placeholder="输入追加的指令或要求…"
      rows="4"
    />
    <div class="panel-actions">
      <button
        class="glass-button primary"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        追加并重新执行
      </button>
      <button class="glass-button" @click="handleCancel">取消</button>
    </div>
  </div>
</template>

<style scoped>
.task-append-panel {
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
