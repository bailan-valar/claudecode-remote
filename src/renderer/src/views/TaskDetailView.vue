<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import StatusBadge from '../components/StatusBadge.vue'
import TaskStatusActions from '../components/TaskStatusActions.vue'
import TaskForm from '../components/TaskForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { Task } from '../../../shared/types'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()

const taskId = route.params.id as string
const task = ref<Task | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)

onMounted(() => {
  task.value = taskStore.tasks.find((t) => t._id === taskId)
  if (!task.value) taskStore.fetch()
  projectStore.fetch()
})

watch(
  () => taskStore.tasks,
  (list) => {
    task.value = list.find((t) => t._id === taskId)
  },
  { immediate: true },
)

async function handleTransition(status: Task['status']) {
  if (!task.value) return
  const result = await taskStore.updateStatus(task.value._id, status)
  if (result.ok) task.value = result.task
}

async function handleUpdate(changes?: Partial<Task>) {
  if (!task.value || !changes) return
  const result = await taskStore.update(task.value._id, changes)
  if (result.ok) {
    task.value = result.task
    isEditing.value = false
  }
}

async function handleDelete() {
  const result = await taskStore.remove(taskId)
  if (result.ok) router.push({ name: 'tasks' })
}
</script>

<template>
  <div v-if="!task" class="loading">加载中...</div>
  <div v-else class="task-detail">
    <header>
      <StatusBadge :status="task.status" />
      <h2 v-if="!isEditing">{{ task.title }}</h2>
      <div class="actions">
        <button v-if="!isEditing" @click="isEditing = true">编辑</button>
        <button v-else @click="isEditing = false">取消编辑</button>
        <button class="danger" @click="showDeleteConfirm = true">删除</button>
      </div>
    </header>

    <TaskForm
      v-if="isEditing"
      :projects="projectStore.projects"
      :initial-task="task"
      mode="edit"
      @submit="handleUpdate"
      @cancel="isEditing = false"
    />

    <section v-else class="info">
      <p><strong>描述：</strong>{{ task.description || '无' }}</p>
      <p><strong>Prompt：</strong></p>
      <pre>{{ task.prompt }}</pre>
      <p>
        <strong>所属项目：</strong>
        {{ projectStore.projects.find((p) => p._id === task!.projectId)?.name ?? task!.projectId }}
      </p>
      <p><strong>优先级：</strong>{{ task.priority }}</p>
      <p><strong>创建时间：</strong>{{ new Date(task.createdAt).toLocaleString() }}</p>
      <p v-if="task.completedAt"><strong>完成时间：</strong>{{ new Date(task.completedAt).toLocaleString() }}</p>
    </section>

    <section class="transitions">
      <h3>状态流转</h3>
      <TaskStatusActions :status="task.status" @transition="handleTransition" />
    </section>

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="showDeleteConfirm"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.task-detail { padding: var(--space-lg); max-width: 800px; }
.loading { padding: var(--space-lg); color: var(--color-muted); }
header { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-lg); flex-wrap: wrap; }
header h2 { flex: 1; margin: 0; }
.actions { display: flex; gap: var(--space-sm); }
.info p { margin-bottom: var(--space-md); line-height: 1.6; }
.info pre { background: #f5f5f5; padding: var(--space-sm); border-radius: var(--radius); white-space: pre-wrap; }
.transitions { margin-top: var(--space-xl); }
.transitions h3 { font-size: 1rem; margin-bottom: var(--space-sm); }
button { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.875rem; cursor: pointer; }
button.danger { border-color: var(--color-error); color: var(--color-error); }
button:hover { background: #f3f4f6; }
</style>
