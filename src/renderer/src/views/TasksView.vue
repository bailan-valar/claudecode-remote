<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import TaskForm from '../components/TaskForm.vue'
import TaskFilters from '../components/TaskFilters.vue'
import StatusBadge from '../components/StatusBadge.vue'
import TaskStatusActions from '../components/TaskStatusActions.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import type { TaskStatus } from '../../../shared/constants'

const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const showForm = ref(false)
const selectedProjectId = ref<string | null>(null)
const selectedStatus = ref<TaskStatus | null>(null)
const deletingTaskId = ref<string | null>(null)

const displayTasks = computed(() => {
  let list = taskStore.tasks
  if (selectedProjectId.value) {
    list = list.filter((t) => t.projectId === selectedProjectId.value)
  }
  if (selectedStatus.value) {
    list = list.filter((t) => t.status === selectedStatus.value)
  }
  return list
})

const projectNameMap = computed(() => {
  const map = new Map<string, string>()
  projectStore.projects.forEach((p) => map.set(p._id, p.name))
  return map
})

onMounted(() => {
  taskStore.fetch()
  projectStore.fetch()
})
</script>

<template>
  <div class="tasks-page">
    <header>
      <h2>任务</h2>
      <button @click="showForm = true">+ 新建任务</button>
    </header>

    <TaskForm
      v-if="showForm"
      :projects="projectStore.projects"
      @submit="showForm = false"
      @cancel="showForm = false"
    />

    <TaskFilters
      :projects="projectStore.projects"
      :selected-project-id="selectedProjectId"
      :selected-status="selectedStatus"
      @update-project="selectedProjectId = $event"
      @update-status="selectedStatus = $event"
    />

    <div v-if="taskStore.isLoading">加载中...</div>
    <EmptyState v-else-if="displayTasks.length === 0" message="暂无任务，点击上方按钮创建" />
    <ul v-else class="task-list">
      <li v-for="t in displayTasks" :key="t._id" class="task-item">
        <div class="row">
          <StatusBadge :status="t.status" />
          <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }" class="title">
            {{ t.title }}
          </RouterLink>
          <span class="project">{{ projectNameMap.get(t.projectId) ?? t.projectId }}</span>
        </div>
        <div class="actions">
          <TaskStatusActions :status="t.status" @transition="taskStore.updateStatus(t._id, $event)" />
          <button class="btn-edit" @click="router.push({ name: 'task-detail', params: { id: t._id } })">编辑</button>
          <button class="btn-delete" @click="deletingTaskId = t._id">删除</button>
        </div>
      </li>
    </ul>

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="deletingTaskId !== null"
      @confirm="taskStore.remove(deletingTaskId!); deletingTaskId = null"
      @cancel="deletingTaskId = null"
    />
  </div>
</template>

<style scoped>
.tasks-page { padding: var(--space-md); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); }
.task-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
.task-item { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-md); }
.row { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }
.title { flex: 1; font-weight: 500; color: var(--color-text); text-decoration: none; }
.title:hover { text-decoration: underline; }
.project { color: var(--color-muted); font-size: 0.875rem; }
.actions { display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; }
.btn-edit, .btn-delete { padding: var(--space-xs) var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.75rem; cursor: pointer; }
.btn-delete { color: var(--color-error); border-color: var(--color-error); }
</style>
