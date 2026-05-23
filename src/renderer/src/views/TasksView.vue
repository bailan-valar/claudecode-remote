<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, defineOptions } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import TaskForm from '../components/TaskForm.vue'
import TaskFilters from '../components/TaskFilters.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import TaskListItem from '../components/TaskListItem.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import type { TaskStatus } from '../../../shared/constants'

defineOptions({
  name: 'TasksView'
})

const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const showForm = ref(false)
const selectedProjectId = ref<string | null>(null)
const selectedStatus = ref<TaskStatus | null>(null)
const deletingTaskId = ref<string | null>(null)
const viewMode = ref<'list' | 'kanban'>('list')

function setViewMode(mode: 'list' | 'kanban') {
  viewMode.value = mode
  if (mode === 'kanban') {
    selectedStatus.value = null
  }
}

function handleMove(taskId: string, status: TaskStatus) {
  taskStore.updateStatus(taskId, status)
}

const displayTasks = computed(() => {
  let list = taskStore.tasks
  if (selectedProjectId.value) {
    list = list.filter((t) => t.projectId === selectedProjectId.value)
  }
  if (viewMode.value === 'list' && selectedStatus.value) {
    list = list.filter((t) => t.status === selectedStatus.value)
  }
  // Sort by updatedAt in descending order (most recent first)
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return list
})

const projectNameMap = computed(() => {
  const map = new Map<string, string>()
  projectStore.projects.forEach((p) => map.set(p._id, p.name))
  return map
})

const tick = ref(0)
let timerId: ReturnType<typeof setInterval> | null = null

function startTick() {
  timerId = setInterval(() => {
    tick.value++
  }, 1000)
}

function stopTick() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

onMounted(() => {
  taskStore.fetch()
  projectStore.fetch()
  startTick()
})

onUnmounted(() => {
  stopTick()
})
</script>

<template>
  <div class="tasks-page" :class="{ 'kanban-active': viewMode === 'kanban' }">
    <header>
      <h1 class="page-title">任务</h1>
      <div class="header-actions">
        <div class="view-toggle">
          <button
            class="glass-button"
            :class="{ active: viewMode === 'list' }"
            @click="setViewMode('list')"
            title="列表视图"
          >
            列表
          </button>
          <button
            class="glass-button"
            :class="{ active: viewMode === 'kanban' }"
            @click="setViewMode('kanban')"
            title="看板视图"
          >
            看板
          </button>
        </div>
        <button class="glass-button primary" @click="showForm = true">+ 新建任务</button>
      </div>
    </header>

    <!-- 新建任务对话框 -->
    <Teleport to="body">
      <div v-if="showForm" class="task-create-overlay" @click.self="showForm = false">
        <div class="task-create-dialog glass-strong">
          <div class="dialog-header">
            <h2>新建任务</h2>
            <button class="close-button" @click="showForm = false">✕</button>
          </div>
          <div class="dialog-body">
            <TaskForm
              :projects="projectStore.projects"
              :tasks="taskStore.tasks"
              mode="create"
              @submit="showForm = false"
              @cancel="showForm = false"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <div class="filters-bar">
      <TaskFilters
        :projects="projectStore.projects"
        :selected-project-id="selectedProjectId"
        :selected-status="selectedStatus"
        :hide-status="viewMode === 'kanban'"
        @update-project="selectedProjectId = $event"
        @update-status="selectedStatus = $event"
      />
    </div>

    <div v-if="taskStore.isLoading" class="loading">加载中...</div>
    <EmptyState v-else-if="displayTasks.length === 0" message="暂无任务，点击上方按钮创建" />
    <template v-else>
      <KanbanBoard
        v-if="viewMode === 'kanban'"
        :tasks="displayTasks"
        :project-name-map="projectNameMap"
        :tick="tick"
        @move="handleMove"
        @edit="router.push({ name: 'task-detail', params: { id: $event } })"
        @delete="deletingTaskId = $event"
      />
      <ul v-else class="task-list">
        <TaskListItem
          v-for="t in displayTasks"
          :key="t._id"
          :task="t"
          :project-name="projectNameMap.get(t.projectId) ?? t.projectId"
          :tick="tick"
          @transition="taskStore.updateStatus(t._id, $event)"
          @edit="router.push({ name: 'task-detail', params: { id: $event } })"
          @delete="deletingTaskId = $event"
        />
      </ul>
    </template>

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

.tasks-page.kanban-active {
  max-width: none;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.form-panel {
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}

.filters-bar {
  margin-bottom: var(--space-md);
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

.header-actions {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.view-toggle {
  display: flex;
  gap: var(--space-xs);
}

.view-toggle .glass-button {
  min-height: 36px;
}

.view-toggle .glass-button.active {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
}

/* 新建任务对话框样式 */
.task-create-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  animation: fadeIn 0.2s ease;
  padding: var(--space-lg);
}

.task-create-dialog {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: scaleIn 0.2s ease;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.dialog-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1.5rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-text);
}

.dialog-body {
  padding: var(--space-lg);
  overflow-y: auto;
  max-height: calc(90vh - 80px);
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

@media (max-width: 640px) {
  .header-actions {
    gap: var(--space-sm);
  }

  .task-create-overlay {
    padding: var(--space-md);
  }

  .task-create-dialog {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .dialog-header {
    padding: var(--space-md);
  }

  .dialog-body {
    padding: var(--space-md);
    max-height: calc(100vh - 70px);
  }
}
</style>
