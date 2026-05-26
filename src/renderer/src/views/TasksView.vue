<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, defineOptions } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import TaskCreatePanel from '../components/TaskCreatePanel.vue'
import TaskEditDialog from '../components/TaskEditDialog.vue'
import TaskFilters from '../components/TaskFilters.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import TaskTreeList from '../components/TaskTreeList.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import type { TaskStatus } from '../../../shared/constants'
import type { Task } from '../../../shared/types'

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
const showTaskDialog = ref(false)
const editingTask = ref<Task | undefined>(undefined)
const viewMode = ref<'list' | 'kanban'>('list')
const listDensity = ref<'comfortable' | 'compact'>('compact')
const subtaskParentId = ref<string | null>(null)
const postTaskPrerequisiteId = ref<string | null>(null)

function openCreateForm() {
  subtaskParentId.value = null
  postTaskPrerequisiteId.value = null
  showForm.value = true
}

function handleAddSubtask(taskId: string) {
  const task = taskStore.tasks.find((t) => t._id === taskId)
  if (task) {
    subtaskParentId.value = taskId
    postTaskPrerequisiteId.value = null
    showForm.value = true
  }
}

function handleAddPostTask(taskId: string) {
  const task = taskStore.tasks.find((t) => t._id === taskId)
  if (task) {
    subtaskParentId.value = null
    postTaskPrerequisiteId.value = taskId
    showForm.value = true
  }
}

function openEditDialog(taskId: string) {
  const task = taskStore.tasks.find((t) => t._id === taskId)
  if (task) {
    editingTask.value = task
    showTaskDialog.value = true
  }
}

function closeTaskDialog() {
  showTaskDialog.value = false
  editingTask.value = undefined
}

async function handleTaskDialogSubmit(task?: Task, changes?: Partial<Task>) {
  showTaskDialog.value = false
  editingTask.value = undefined
  if (task && changes) {
    const result = await taskStore.update(task._id, changes)
    if (result.ok) {
      await taskStore.fetch()
    }
  }
}

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

  // 监听悬浮按钮的点击事件
  window.addEventListener('open-task-create', openCreateForm)
})

onUnmounted(() => {
  stopTick()

  // 移除事件监听
  window.removeEventListener('open-task-create', openCreateForm)
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
        <div v-if="viewMode === 'list'" class="density-toggle">
          <button
            class="glass-button"
            :class="{ active: listDensity === 'comfortable' }"
            @click="listDensity = 'comfortable'"
            title="舒适模式"
          >
            舒适
          </button>
          <button
            class="glass-button"
            :class="{ active: listDensity === 'compact' }"
            @click="listDensity = 'compact'"
            title="紧凑模式"
          >
            紧凑
          </button>
        </div>
        <button class="glass-button primary" @click="openCreateForm">+ 新建任务</button>
      </div>
    </header>

    <!-- 新建任务弹框 -->
    <TaskCreatePanel
      v-model:visible="showForm"
      :projects="projectStore.projects"
      :tasks="taskStore.tasks"
      :default-project-id="subtaskParentId ? (taskStore.tasks.find((t) => t._id === subtaskParentId)?.projectId ?? '') : (postTaskPrerequisiteId ? (taskStore.tasks.find((t) => t._id === postTaskPrerequisiteId)?.projectId ?? '') : '')"
      :default-parent-task-id="subtaskParentId ?? undefined"
      :default-prerequisite-task-ids="postTaskPrerequisiteId ? [postTaskPrerequisiteId] : undefined"
      :title="subtaskParentId ? '添加子任务' : (postTaskPrerequisiteId ? '新增后置任务' : '新建任务')"
      @submit="showForm = false; subtaskParentId = null; postTaskPrerequisiteId = null"
      @cancel="showForm = false; subtaskParentId = null; postTaskPrerequisiteId = null"
    />

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
        @edit="openEditDialog($event)"
        @delete="deletingTaskId = $event"
        @add-subtask="handleAddSubtask"
        @add-post-task="handleAddPostTask"
      />
      <TaskTreeList
        v-else
        :tasks="displayTasks"
        :project-name-map="projectNameMap"
        :tick="tick"
        :mode="listDensity"
        @transition="handleMove"
        @edit="openEditDialog($event)"
        @delete="deletingTaskId = $event"
        @add-subtask="handleAddSubtask"
        @add-post-task="handleAddPostTask"
      />
    </template>

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="deletingTaskId !== null"
      @confirm="taskStore.remove(deletingTaskId!); deletingTaskId = null"
      @cancel="deletingTaskId = null"
    />

    <TaskEditDialog
      :visible="showTaskDialog"
      :task="editingTask"
      :projects="projectStore.projects"
      :tasks="taskStore.tasks"
      mode="edit"
      @submit="handleTaskDialogSubmit"
      @cancel="closeTaskDialog"
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
  gap: var(--space-sm);
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

.density-toggle {
  display: flex;
  gap: var(--space-xs);
}

.density-toggle .glass-button {
  min-height: 36px;
  font-size: 0.875rem;
  padding: var(--space-xs) var(--space-sm);
}

.density-toggle .glass-button.active {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
}

@media (max-width: 640px) {
  .header-actions {
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .task-list {
    gap: var(--space-xs);
  }

  .view-toggle .glass-button {
    min-height: 32px;
    font-size: 0.875rem;
    padding: var(--space-xs) var(--space-sm);
  }

  .density-toggle .glass-button {
    min-height: 32px;
    font-size: 0.875rem;
    padding: var(--space-xs) var(--space-sm);
  }

  .header-actions .glass-button.primary {
    min-height: 32px;
    font-size: 0.875rem;
    padding: var(--space-xs) var(--space-md);
  }
}
</style>
