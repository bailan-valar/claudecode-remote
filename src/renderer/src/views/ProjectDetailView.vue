<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import ProjectForm from '../components/ProjectForm.vue'
import TaskForm from '../components/TaskForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { formatDurationShort } from '../utils/formatDuration'
import { calculateLiveDuration, isTracking } from '../utils/timeTracking'
import { KIND_LABEL } from '../../../shared/constants'
import type { Project, Task } from '../../../shared/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const taskStore = useTaskStore()

const projectId = route.params.id as string
const project = ref<Project | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)
const showCreateTask = ref(false)
const activeTab = ref<'info' | 'tasks'>('info')
const tick = ref(0)
let timerId: ReturnType<typeof setInterval> | null = null

const PRIORITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#34c759',
  medium: '#ff9500',
  high: '#ff3b30',
}

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

function taskDuration(t: Task) {
  void tick.value
  return calculateLiveDuration(t)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  project.value = projectStore.projects.find((p) => p._id === projectId)
  if (!project.value) projectStore.fetch()
  taskStore.fetch(projectId)
  startTick()
})

onUnmounted(() => {
  stopTick()
})

watch(
  () => projectStore.projects,
  (list) => {
    project.value = list.find((p) => p._id === projectId)
  },
  { immediate: true },
)

async function handleUpdate(changes?: Partial<Project>) {
  if (!project.value || !changes) return
  const result = await projectStore.update(project.value._id, changes)
  if (result.ok) {
    project.value = result.project
    isEditing.value = false
  }
}

async function handleDelete() {
  const result = await projectStore.remove(projectId)
  if (result.ok) router.push({ name: 'projects' })
}

async function handleTaskCreated() {
  showCreateTask.value = false
  await taskStore.fetch(projectId)
}

const deletingTaskId = ref<string | null>(null)

async function handleDeleteTask(taskId: string) {
  deletingTaskId.value = null
  await taskStore.remove(taskId)
}
</script>

<template>
  <div v-if="!project" class="loading">加载中...</div>
  <div v-else class="project-detail">
    <header>
      <h1 v-if="!isEditing" class="page-title">{{ project.name }}</h1>
      <div class="actions">
        <button v-if="!isEditing" class="glass-button" @click="isEditing = true">编辑</button>
        <button v-else class="glass-button" @click="isEditing = false">取消编辑</button>
        <button class="glass-button danger" @click="showDeleteConfirm = true">删除</button>
      </div>
    </header>

    <div v-if="isEditing" class="form-panel glass">
      <ProjectForm
        :initial-project="project"
        mode="edit"
        @submit="handleUpdate"
        @cancel="isEditing = false"
      />
    </div>

    <template v-else>
      <!-- Tab 切换 -->
      <div class="tab-bar">
        <button
          class="tab-button"
          :class="{ active: activeTab === 'info' }"
          @click="activeTab = 'info'"
        >
          项目信息
        </button>
        <button
          class="tab-button"
          :class="{ active: activeTab === 'tasks' }"
          @click="activeTab = 'tasks'"
        >
          任务列表（{{ taskStore.filteredTasks.length }}）
        </button>
      </div>

      <!-- 项目信息 -->
      <section v-show="activeTab === 'info'" class="info glass">
        <div class="info-row">
          <span class="info-label">路径</span>
          <span class="info-value mono">{{ project.path }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">描述</span>
          <span class="info-value">{{ project.description || '无' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">允许的工具</span>
          <span class="info-value">{{ project.allowedTools?.join(', ') ?? 'Read, Edit, Bash' }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">LLM Provider</span>
          <span class="info-value">{{ project.llmConfig?.provider ?? 'Anthropic 官方' }}</span>
        </div>
        <div v-if="project.llmConfig?.baseUrl" class="info-row">
          <span class="info-label">Base URL</span>
          <span class="info-value mono">{{ project.llmConfig.baseUrl }}</span>
        </div>
        <div v-if="project.llmConfig?.model" class="info-row">
          <span class="info-label">模型</span>
          <span class="info-value mono">{{ project.llmConfig.model }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">企业微信通知</span>
          <span class="info-value">{{ project.webhookEnabled ? '已启用' : '未启用' }}</span>
        </div>
        <div v-if="project.webhookEnabled && project.webhookUrl" class="info-row">
          <span class="info-label">Webhook</span>
          <span class="info-value mono">{{ project.webhookUrl }}</span>
        </div>
        <div v-if="project.webhookEnabled" class="info-row">
          <span class="info-label">失败时通知</span>
          <span class="info-value">{{ (project.webhookNotifyOnFailure ?? true) ? '是' : '否' }}</span>
        </div>
        <div v-if="project.webhookEnabled && project.webhookMentionedList?.length" class="info-row">
          <span class="info-label">@提及成员</span>
          <span class="info-value">{{ project.webhookMentionedList.join(', ') }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">创建时间</span>
          <span class="info-value">{{ new Date(project.createdAt).toLocaleString() }}</span>
        </div>
      </section>

      <!-- 任务列表 -->
      <section v-show="activeTab === 'tasks'" class="tasks">
        <div class="tasks-header">
          <button v-if="!showCreateTask" class="glass-button primary" @click="showCreateTask = true">+ 新建任务</button>
          <button v-else class="glass-button" @click="showCreateTask = false">取消</button>
        </div>

        <div v-if="showCreateTask" class="form-panel glass">
          <TaskForm
            :projects="project ? [project] : []"
            :tasks="taskStore.filteredTasks"
            :default-project-id="projectId"
            mode="create"
            @submit="handleTaskCreated"
            @cancel="showCreateTask = false"
          />
        </div>

        <ul v-if="taskStore.filteredTasks.length" class="task-list">
          <li v-for="t in taskStore.filteredTasks" :key="t._id" class="task-item glass glass-hover">
            <div class="row">
              <StatusBadge :status="t.status" />
              <span class="kind-badge">{{ KIND_LABEL[t.kind] ?? t.kind ?? '任务' }}</span>
              <span
                class="priority-badge"
                :style="{
                  backgroundColor: PRIORITY_COLOR[t.priority] + '18',
                  color: PRIORITY_COLOR[t.priority],
                  borderColor: PRIORITY_COLOR[t.priority] + '30',
                }"
              >
                {{ PRIORITY_LABEL[t.priority] ?? t.priority }}
              </span>
              <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }" class="task-title">
                {{ t.title }}
              </RouterLink>
              <span v-if="(t.totalDuration ?? 0) > 0 || isTracking(t)" class="duration" :class="{ 'duration-active': isTracking(t) }">
                {{ formatDurationShort(taskDuration(t)) }}
                <span v-if="isTracking(t)" class="tracking-dot">●</span>
              </span>
              <span class="created-at">{{ formatDate(t.createdAt) }}</span>
            </div>
            <div class="task-actions">
              <button class="glass-button btn-edit" @click="router.push({ name: 'task-detail', params: { id: t._id } })">编辑</button>
              <button class="glass-button danger btn-delete" @click="deletingTaskId = t._id">删除</button>
            </div>
          </li>
        </ul>
        <p v-else class="empty">该项目暂无任务</p>
      </section>
    </template>

    <ConfirmDialog
      title="确认删除"
      message="删除项目将同时移除其所有任务，确定要继续吗？"
      :visible="showDeleteConfirm"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="deletingTaskId !== null"
      @confirm="handleDeleteTask(deletingTaskId!)"
      @cancel="deletingTaskId = null"
    />
  </div>
</template>

<style scoped>
.project-detail {
  max-width: 900px;
  margin: 0 auto;
}

.loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

header .actions {
  display: flex;
  gap: var(--space-sm);
}

.form-panel {
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}

/* ── Tab 切换 ── */
.tab-bar {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-lg);
}

.tab-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text);
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 var(--glass-highlight);
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
  cursor: pointer;
  min-height: 40px;
}

.tab-button:hover {
  background: var(--glass-bg-hover);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 var(--glass-highlight);
  transform: translateY(-1px);
}

.tab-button.active {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(0, 113, 227, 0.25);
}

.tab-button.active:hover {
  background: var(--color-accent-hover);
  box-shadow: 0 6px 20px rgba(0, 113, 227, 0.35);
}

/* ── 项目信息 ── */
.info {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.info-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-value {
  font-size: 0.9375rem;
  color: var(--color-text);
  line-height: 1.5;
}

.info-value.mono {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
}

/* ── 任务列表 ── */
.tasks-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
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

.task-title {
  flex: 1;
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--color-text);
  text-decoration: none;
  min-width: 0;
  letter-spacing: -0.01em;
}

.task-title:hover {
  color: var(--color-accent);
  opacity: 1;
}

.kind-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid var(--glass-border-subtle);
}

.priority-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  white-space: nowrap;
  border: 1px solid transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.duration {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.duration-active {
  color: var(--color-accent, #007aff);
  background: rgba(0, 122, 255, 0.08);
  font-weight: 600;
}

.tracking-dot {
  color: #34c759;
  margin-left: 2px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.created-at {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.task-actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
}

.task-actions .glass-button {
  font-size: 0.8125rem;
  padding: var(--space-xs) var(--space-md);
  min-height: 32px;
}

.empty {
  color: var(--color-text-secondary);
  padding: var(--space-xl);
  text-align: center;
  font-size: 0.9375rem;
}

@media (max-width: 640px) {
  .task-item {
    padding: var(--space-md);
  }

  .task-actions {
    width: 100%;
    margin-top: var(--space-sm);
  }

  .task-actions .glass-button {
    font-size: 0.875rem;
    padding: var(--space-sm) var(--space-md);
    flex: 1;
    min-height: 40px;
  }
}
</style>
