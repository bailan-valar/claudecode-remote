<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import StatusBadge from '../components/StatusBadge.vue'
import TaskStatusActions from '../components/TaskStatusActions.vue'
import TaskForm from '../components/TaskForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { formatDuration } from '../utils/formatDuration'
import { isTracking, calculateLiveDuration } from '../utils/timeTracking'
import { TASK_STATUS, KIND_LABEL } from '../../../shared/constants'
import { STATUS_LABEL } from '../utils/taskTransitions'
import type { Task } from '../../../shared/types'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()

const taskId = route.params.id as string
const task = ref<Task | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)
const liveDuration = ref(0)
const logListRef = ref<HTMLElement | null>(null)
let timerId: ReturnType<typeof setInterval> | null = null

// 追加任务
const showAppendPanel = ref(false)
const appendContent = ref('')

// 新增子任务
const showSubtaskPanel = ref(false)
const subtaskTitle = ref('')
const subtaskPrompt = ref('')

const childTasks = computed(() => {
  if (!task.value) return []
  return taskStore.tasks
    .filter((t) => t.parentTaskId === task.value!._id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})

const parentTask = computed(() => {
  if (!task.value?.parentTaskId) return undefined
  return taskStore.tasks.find((t) => t._id === task.value!.parentTaskId)
})

function scrollLogsToBottom() {
  nextTick(() => {
    if (logListRef.value) {
      logListRef.value.scrollTop = logListRef.value.scrollHeight
    }
  })
}

// 内联编辑状态
const isEditingStatus = ref(false)
const editingStatus = ref<Task['status']>('planned')

function startEditStatus() {
  if (!task.value) return
  editingStatus.value = task.value.status
  isEditingStatus.value = true
}

async function saveStatus() {
  if (!task.value) return
  const newStatus = editingStatus.value
  isEditingStatus.value = false
  if (newStatus !== task.value.status) {
    await handleTransition(newStatus)
  }
}

function startTimer() {
  stopTimer()
  if (!task.value) return
  liveDuration.value = calculateLiveDuration(task.value)
  if (isTracking(task.value)) {
    timerId = setInterval(() => {
      if (task.value) {
        liveDuration.value = calculateLiveDuration(task.value)
      }
    }, 1000)
  }
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

onUnmounted(() => stopTimer())

onMounted(() => {
  task.value = taskStore.tasks.find((t) => t._id === taskId)
  if (!task.value) taskStore.fetch()
  projectStore.fetch()
})

watch(
  () => taskStore.tasks,
  (list) => {
    task.value = list.find((t) => t._id === taskId)
    startTimer()
  },
  { immediate: true },
)

watch(
  () => task.value?.logs.length,
  () => {
    if (task.value?.logs.length) {
      scrollLogsToBottom()
    }
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

// ── 追加任务 ──
async function handleAppend() {
  if (!task.value || !appendContent.value.trim()) return
  const newPrompt = task.value.prompt + '\n\n--- 追加 ---\n' + appendContent.value.trim()
  const result = await taskStore.update(task.value._id, {
    prompt: newPrompt,
    status: TASK_STATUS.PENDING,
    reviewFeedback: undefined,
    completedAt: null,
  })
  if (result.ok) {
    task.value = result.task
    appendContent.value = ''
    showAppendPanel.value = false
  }
}

// ── 新增子任务 ──
async function handleCreateSubtask() {
  if (!task.value || !subtaskTitle.value.trim() || !subtaskPrompt.value.trim()) return
  const result = await taskStore.create({
    title: subtaskTitle.value.trim(),
    prompt: subtaskPrompt.value.trim(),
    projectId: task.value.projectId,
    parentTaskId: task.value._id,
    claudeSessionId: task.value.claudeSessionId ?? undefined,
    status: TASK_STATUS.PENDING,
    kind: 'task',
  })
  if (result.ok) {
    subtaskTitle.value = ''
    subtaskPrompt.value = ''
    showSubtaskPanel.value = false
    await taskStore.fetch()
  }
}
</script>

<template>
  <div v-if="!task" class="loading">加载中...</div>
  <div v-else class="task-detail">
    <header>
      <div class="header-left">
        <template v-if="!isEditingStatus">
          <StatusBadge :status="task.status" :class="['status-editable', { disabled: isEditing }]" @click="!isEditing && startEditStatus()" />
        </template>
        <select
          v-else
          v-model="editingStatus"
          class="glass-input status-select"
          @change="saveStatus"
        >
          <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
        <h1 v-if="!isEditing" class="page-title">{{ task.title }}</h1>
      </div>
      <div class="actions">
        <button class="glass-button" :class="{ active: showAppendPanel }" @click="showAppendPanel = !showAppendPanel; showSubtaskPanel = false">追加任务</button>
        <button class="glass-button" :class="{ active: showSubtaskPanel }" @click="showSubtaskPanel = !showSubtaskPanel; showAppendPanel = false">新增子任务</button>
        <button v-if="!isEditing" class="glass-button" @click="isEditing = true">编辑</button>
        <button v-else class="glass-button" @click="isEditing = false">取消编辑</button>
        <button class="glass-button danger" @click="showDeleteConfirm = true">删除</button>
      </div>
    </header>

    <div v-if="isEditing" class="form-panel glass">
      <TaskForm
        :projects="projectStore.projects"
        :initial-task="task"
        mode="edit"
        @submit="handleUpdate"
        @cancel="isEditing = false"
      />
    </div>

    <!-- 追加任务面板 -->
    <div v-if="showAppendPanel" class="form-panel glass">
      <h3 class="panel-title">追加任务内容</h3>
      <p class="panel-hint">以下内容将追加到当前任务的 Prompt 末尾，并重新提交执行。</p>
      <textarea v-model="appendContent" class="glass-input" placeholder="输入追加的指令或要求…" rows="4" />
      <div class="panel-actions">
        <button class="glass-button primary" :disabled="!appendContent.trim()" @click="handleAppend">追加并重新执行</button>
        <button class="glass-button" @click="showAppendPanel = false">取消</button>
      </div>
    </div>

    <!-- 新增子任务面板 -->
    <div v-if="showSubtaskPanel" class="form-panel glass">
      <h3 class="panel-title">新增子任务</h3>
      <p class="panel-hint">子任务将与父任务共用同一个 Claude Session 继续执行。</p>
      <input v-model="subtaskTitle" class="glass-input" placeholder="子任务标题" required />
      <textarea v-model="subtaskPrompt" class="glass-input" placeholder="给 Claude Code 的 Prompt" rows="4" required />
      <div class="panel-actions">
        <button class="glass-button primary" :disabled="!subtaskTitle.trim() || !subtaskPrompt.trim()" @click="handleCreateSubtask">创建子任务</button>
        <button class="glass-button" @click="showSubtaskPanel = false">取消</button>
      </div>
    </div>

    <section v-if="!isEditing" class="info glass">
      <div class="info-row">
        <span class="info-label">状态</span>
        <span class="info-value">
          <template v-if="!isEditingStatus">
            <StatusBadge :status="task.status" :class="['status-editable', { disabled: isEditing }]" @click="!isEditing && startEditStatus()" />
          </template>
          <select
            v-else
            v-model="editingStatus"
            class="glass-input status-select"
            @change="saveStatus"
          >
            <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
          </select>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">类型</span>
        <span class="info-value">{{ KIND_LABEL[task.kind] ?? task.kind ?? '任务' }}</span>
      </div>
      <div v-if="parentTask" class="info-row">
        <span class="info-label">父任务</span>
        <span class="info-value">
          <RouterLink :to="{ name: 'task-detail', params: { id: parentTask._id } }" class="parent-link">
            {{ parentTask.title }}
          </RouterLink>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">描述</span>
        <span class="info-value">{{ task.description || '无' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Prompt</span>
        <pre class="prompt-block">{{ task.prompt }}</pre>
      </div>
      <div class="info-row">
        <span class="info-label">所属项目</span>
        <span class="info-value">
          {{ projectStore.projects.find((p) => p._id === task!.projectId)?.name ?? task!.projectId }}
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">优先级</span>
        <span class="info-value">{{ task.priority }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">创建时间</span>
        <span class="info-value">{{ new Date(task.createdAt).toLocaleString() }}</span>
      </div>
      <div v-if="task.completedAt" class="info-row">
        <span class="info-label">完成时间</span>
        <span class="info-value">{{ new Date(task.completedAt).toLocaleString() }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">开发时长</span>
        <span class="info-value" :class="{ 'timer-active': isTracking(task) }">
          {{ formatDuration(liveDuration) }}
          <span v-if="isTracking(task)" class="tracking-dot">●</span>
        </span>
      </div>
    </section>

    <!-- 子任务列表 -->
    <section v-if="childTasks.length" class="child-tasks">
      <h2 class="section-title">子任务</h2>
      <ul class="child-task-list">
        <li v-for="ct in childTasks" :key="ct._id" class="child-task-item glass">
          <div class="child-task-row">
            <StatusBadge :status="ct.status" />
            <RouterLink :to="{ name: 'task-detail', params: { id: ct._id } }" class="child-task-title">
              {{ ct.title }}
            </RouterLink>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="task.logs.length" class="logs">
      <h2 class="section-title">执行日志</h2>
      <div ref="logListRef" class="log-list glass">
        <div
          v-for="(log, idx) in task.logs"
          :key="idx"
          :class="['log-entry', log.level]"
        >
          <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
          <pre class="log-message">{{ log.message }}</pre>
        </div>
      </div>
    </section>

    <section class="transitions">
      <h2 class="section-title">状态流转</h2>
      <div class="transitions-panel glass">
        <TaskStatusActions :status="task.status" @transition="handleTransition" />
      </div>
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
.task-detail {
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 1;
  min-width: 0;
}

header .page-title {
  margin-bottom: 0;
  font-size: 1.5rem;
}

header .actions {
  display: flex;
  gap: var(--space-sm);
}

.form-panel {
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.info {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
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
  line-height: 1.6;
}

.timer-active {
  color: var(--color-accent, #007aff);
  font-weight: 600;
}

.tracking-dot {
  color: #34c759;
  margin-left: var(--space-xs);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-editable {
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.status-editable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.status-editable.disabled {
  cursor: default;
  pointer-events: none;
}

.status-select {
  width: auto;
  min-width: 120px;
  font-size: 0.8125rem;
  padding: 0.35rem 0.75rem;
  height: auto;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.prompt-block {
  background: rgba(0, 0, 0, 0.04);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  border: 1px solid var(--glass-border-subtle);
}

.logs {
  margin-top: var(--space-2xl);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.log-list {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-md);
}

.log-entry {
  margin-bottom: var(--space-md);
  font-size: 0.875rem;
}

.log-entry:last-child {
  margin-bottom: 0;
}

.log-time {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  margin-right: var(--space-sm);
  font-family: 'SF Mono', Monaco, monospace;
}

.log-message {
  white-space: pre-wrap;
  margin: 0.25rem 0 0 0;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text);
}

.log-entry.error .log-message {
  color: var(--color-error);
}

.transitions {
  margin-top: var(--space-2xl);
}

.transitions-panel {
  padding: var(--space-lg);
}

/* ── 追加 / 子任务面板 ── */
.panel-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 var(--space-xs) 0;
  color: var(--color-text);
}

.panel-hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-md) 0;
}

.panel-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

/* ── 父任务链接 ── */
.parent-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 500;
}

.parent-link:hover {
  text-decoration: underline;
}

/* ── 子任务列表 ── */
.child-tasks {
  margin-top: var(--space-2xl);
}

.child-task-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.child-task-item {
  padding: var(--space-md);
}

.child-task-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.child-task-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text);
  text-decoration: none;
}

.child-task-title:hover {
  color: var(--color-accent);
}

@media (max-width: 640px) {
  .task-detail {
    padding: 0;
  }

  header {
    margin-bottom: var(--space-lg);
  }

  header .actions {
    width: 100%;
  }

  header .actions .glass-button {
    flex: 1;
    min-height: 40px;
  }

  .transitions-panel :deep(.actions) {
    flex-direction: column;
  }

  .transitions-panel :deep(.actions button) {
    width: 100%;
    min-height: 44px;
  }
}
</style>
