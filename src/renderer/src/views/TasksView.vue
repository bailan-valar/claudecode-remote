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
      <h1 class="page-title">任务</h1>
      <button class="glass-button primary" @click="showForm = true">+ 新建任务</button>
    </header>

    <div v-if="showForm" class="form-panel glass">
      <TaskForm
        :projects="projectStore.projects"
        :tasks="taskStore.tasks"
        @submit="showForm = false"
        @cancel="showForm = false"
      />
    </div>

    <div class="filters-bar">
      <TaskFilters
        :projects="projectStore.projects"
        :selected-project-id="selectedProjectId"
        :selected-status="selectedStatus"
        @update-project="selectedProjectId = $event"
        @update-status="selectedStatus = $event"
      />
    </div>

    <div v-if="taskStore.isLoading" class="loading">加载中...</div>
    <EmptyState v-else-if="displayTasks.length === 0" message="暂无任务，点击上方按钮创建" />
    <ul v-else class="task-list">
      <li v-for="t in displayTasks" :key="t._id" class="task-item glass glass-hover">
        <div class="row">
          <StatusBadge :status="t.status" />
          <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }" class="title">
            {{ t.title }}
          </RouterLink>
          <span class="project">{{ projectNameMap.get(t.projectId) ?? t.projectId }}</span>
        </div>
        <div class="actions">
          <TaskStatusActions :status="t.status" @transition="taskStore.updateStatus(t._id, $event)" />
          <button class="glass-button btn-edit" @click="router.push({ name: 'task-detail', params: { id: t._id } })">
            编辑
          </button>
          <button class="glass-button danger btn-delete" @click="deletingTaskId = t._id">
            删除
          </button>
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
.tasks-page {
  max-width: 900px;
  margin: 0 auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.form-panel {
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.filters-bar {
  margin-bottom: var(--space-lg);
}

.loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.task-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.task-item {
  padding: var(--space-lg);
  cursor: default;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}

.title {
  flex: 1;
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--color-text);
  text-decoration: none;
  min-width: 0;
  letter-spacing: -0.01em;
}

.title:hover {
  color: var(--color-accent);
  opacity: 1;
}

.project {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
}

.actions .glass-button {
  font-size: 0.8125rem;
  padding: var(--space-xs) var(--space-md);
  min-height: 32px;
}

@media (max-width: 640px) {
  .task-item {
    padding: var(--space-md);
  }

  .actions {
    width: 100%;
    margin-top: var(--space-sm);
  }

  .actions .glass-button {
    font-size: 0.875rem;
    padding: var(--space-sm) var(--space-md);
    flex: 1;
    min-height: 40px;
  }
}
</style>
