<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed, defineOptions, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import { apiClient } from '../api'
import StatusBadge from '../components/StatusBadge.vue'
import TaskStatusActions from '../components/TaskStatusActions.vue'
import TaskListItem from '../components/TaskListItem.vue'
import TaskEditPanel from '../components/TaskEditPanel.vue'
import TaskAppendPanel from '../components/TaskAppendPanel.vue'
import TaskCreatePanel from '../components/TaskCreatePanel.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { formatDuration } from '../utils/formatDuration'
import { isTracking, calculateLiveDuration } from '../utils/timeTracking'
import { TASK_STATUS, KIND_LABEL } from '../../../shared/constants'
import { STATUS_LABEL } from '../utils/taskTransitions'
import type { Task, StatusHistoryEntry } from '../../../shared/types'

defineOptions({
  name: 'TaskDetailView'
})

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()

const taskId = route.params.id as string
const task = ref<Task | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)
const liveDuration = ref(0)
let timerId: ReturnType<typeof setInterval> | null = null

// Tab 切换
const activeTab = ref<'detail' | 'logs'>('detail')
const selectedPhaseIndex = ref(0)

// 日志列表引用
const logListRef = ref<HTMLElement | null>(null)

// 定时刷新任务数据的定时器（已由全局SSE事件替代，保留作为备份）
let refreshTimerId: ReturnType<typeof setInterval> | null = null

// SSE事件监听器取消函数
let unsubscribeLogsUpdated: (() => void) | null = null

// 控制是否隐藏工具调用（从本地存储读取偏好）
const hideToolCalls = ref(localStorage.getItem('hideToolCalls') === 'true')

// 监听变化，保存到本地存储
watch(hideToolCalls, (newValue) => {
  localStorage.setItem('hideToolCalls', String(newValue))
})

// 计算被隐藏的工具调用数量
function getHiddenToolCallsCount(phase: StatusHistoryEntry) {
  if (!task.value || !hideToolCalls.value) return 0
  const start = new Date(phase.startedAt).getTime()
  const end = phase.endedAt ? new Date(phase.endedAt).getTime() : Date.now()
  return task.value.logs.filter((log) => {
    const t = new Date(log.timestamp).getTime()
    const inTimeRange = t >= start && t <= end
    const isToolCall = log.message.trim().startsWith('[工具]')
    return inTimeRange && isToolCall
  }).length
}

// 追加任务
const showAppendPanel = ref(false)

// 新增子任务
const showSubtaskPanel = ref(false)
const showPlanFullscreen = ref(false)

// 继续执行
const isResuming = ref(false)

const canResume = computed(() => {
  if (!task.value) return false
  const hasSessionId = !!task.value.claudeSessionId
  const isPendingOrPlanRequired =
    task.value.status === TASK_STATUS.PENDING || task.value.status === TASK_STATUS.PLAN_REQUIRED
  const wasStopped = task.value.reviewFeedback?.includes('已停止') || task.value.reviewFeedback?.includes('停止')
  return hasSessionId && isPendingOrPlanRequired && wasStopped
})

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

// 执行阶段列表（倒序排列，最新的在最上面）
const executionPhases = computed(() => {
  if (!task.value) return []
  if (task.value.statusHistory && task.value.statusHistory.length > 0) {
    return [...task.value.statusHistory].reverse()
  }
  // 兼容旧数据：基于 timeEntries
  const phases: StatusHistoryEntry[] = []
  if (task.value.timeEntries) {
    for (const entry of task.value.timeEntries) {
      phases.push({
        status: entry.status ?? (task.value.isPlan ? 'planning' : 'developing'),
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
      })
    }
  }
  // 当前状态兜底
  if (phases.length === 0 || phases[phases.length - 1].endedAt) {
    phases.push({
      status: task.value.status,
      startedAt: task.value.updatedAt || task.value.createdAt,
    })
  }
  return phases.reverse()
})

const selectedPhase = computed(() => executionPhases.value[selectedPhaseIndex.value])

function formatPhaseTime(phase: StatusHistoryEntry) {
  const start = new Date(phase.startedAt)
  const end = phase.endedAt ? new Date(phase.endedAt) : null
  const fmt = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const HH = String(d.getHours()).padStart(2, '0')
    const MM = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd} ${HH}:${MM}`
  }
  if (end) {
    return `${fmt(start)} - ${fmt(end)}`
  }
  return `${fmt(start)} - 进行中`
}

function getPhaseLogs(phase: StatusHistoryEntry) {
  if (!task.value) return []
  const start = new Date(phase.startedAt).getTime()
  const end = phase.endedAt ? new Date(phase.endedAt).getTime() : Date.now()
  return task.value.logs.filter((log) => {
    const t = new Date(log.timestamp).getTime()
    const inTimeRange = t >= start && t <= end
    // 如果启用了隐藏工具调用，过滤掉以"[工具]"开头的日志
    const notToolCall = !hideToolCalls.value || !log.message.trim().startsWith('[工具]')
    return inTimeRange && notToolCall
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

onUnmounted(() => {
  stopTimer()
  if (refreshTimerId) {
    clearInterval(refreshTimerId)
    refreshTimerId = null
  }
  if (unsubscribeLogsUpdated) {
    unsubscribeLogsUpdated()
    unsubscribeLogsUpdated = null
  }
})

onMounted(() => {
  task.value = taskStore.tasks.find((t) => t._id === taskId)
  if (!task.value) taskStore.fetch()
  projectStore.fetch()

  // 启动轻量级定时刷新：仅作为SSE机制的备份（30秒间隔）
  refreshTimerId = setInterval(() => {
    taskStore.fetch()
  }, 30000)

  // 监听SSE日志更新事件（主要更新机制）
  unsubscribeLogsUpdated = apiClient.onEngineTaskLogsUpdated((updatedTaskId: string) => {
    // 如果是当前任务，立即刷新数据
    if (updatedTaskId === taskId) {
      taskStore.fetch()
    }
  })
})

watch(
  () => taskStore.tasks,
  (list) => {
    task.value = list.find((t) => t._id === taskId)
    startTimer()
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
async function handleAppend(content: string) {
  if (!task.value || !content.trim()) return
  // 追加内容到描述字段
  const newDescription = task.value.description
    ? task.value.description + '\n\n--- 追加 ---\n' + content.trim()
    : content.trim()
  const result = await taskStore.update(task.value._id, {
    description: newDescription,
    status: TASK_STATUS.PENDING,
    reviewFeedback: undefined,
    completedAt: null,
  })
  if (result.ok) {
    task.value = result.task
    showAppendPanel.value = false
  }
}

// ── 新增子任务 ──
async function handleCreateSubtask(changes?: Partial<Task>) {
  // 子任务创建完成，刷新列表
  showSubtaskPanel.value = false
  await taskStore.fetch()
}

// ── 子任务操作 ──
async function handleEditChildTask(childTaskId: string) {
  router.push({ name: 'task-detail', params: { id: childTaskId } })
}

const deletingChildTaskId = ref<string | null>(null)

async function handleDeleteChildTask(childTaskId: string) {
  deletingChildTaskId.value = null
  await taskStore.remove(childTaskId)
  // 刷新任务列表
  await taskStore.fetch()
}

// ── 复制 Session ID ──
function copySessionId() {
  if (!task.value?.claudeSessionId) return
  navigator.clipboard.writeText(task.value.claudeSessionId)
}

// ── 继续执行 ──
async function handleResume() {
  if (!task.value) return
  isResuming.value = true
  try {
    const result = await taskStore.resume(task.value._id)
    if (result.ok) {
      // 刷新任务数据
      await taskStore.fetch()
    } else {
      alert(result.error || '继续执行失败')
    }
  } finally {
    isResuming.value = false
  }
}

// ── 滚动日志到底部 ──
function scrollLogsToBottom() {
  nextTick(() => {
    if (logListRef.value) {
      logListRef.value.scrollTop = logListRef.value.scrollHeight
    }
  })
}

// ── 监听tab切换、阶段选择和日志变化，自动滚动到底部 ──
watch([activeTab, selectedPhaseIndex, () => selectedPhase.value?.status], () => {
  if (activeTab.value === 'logs') {
    scrollLogsToBottom()
  }
})

// ── 监听日志内容变化，自动滚动到底部 ──
watch(() => task.value?.logs, () => {
  if (activeTab.value === 'logs') {
    scrollLogsToBottom()
  }
}, { deep: true })
</script>

<template>
  <div v-if="!task" class="loading">加载中...</div>
  <div v-else class="task-detail">
    <!-- 计划全屏查看 -->
    <div v-if="showPlanFullscreen" class="plan-fullscreen-overlay" @click.self="showPlanFullscreen = false">
      <div class="plan-fullscreen-content glass-strong">
        <div class="plan-fullscreen-header">
          <h2>开发计划：{{ task.title }}</h2>
          <button class="glass-button" @click="showPlanFullscreen = false">关闭</button>
        </div>
        <pre class="plan-fullscreen-body">{{ task.planOutput }}</pre>
      </div>
    </div>
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

    <TaskEditPanel
      v-model:editing="isEditing"
      :task="task"
      :projects="projectStore.projects"
      @submit="handleUpdate"
    />

    <!-- 追加任务面板 -->
    <div v-if="showAppendPanel" class="form-panel glass">
      <TaskAppendPanel
        @submit="handleAppend"
        @cancel="showAppendPanel = false"
      />
    </div>

    <!-- 新增子任务弹框 -->
    <TaskCreatePanel
      v-model:visible="showSubtaskPanel"
      :projects="projectStore.projects"
      :tasks="taskStore.tasks"
      :default-project-id="task?.projectId"
      :default-parent-task-id="task?._id"
      title="新建子任务"
      @submit="handleCreateSubtask"
      @cancel="showSubtaskPanel = false"
    />

    <!-- 顶部 Tab -->
    <div class="tabs-bar">
      <button :class="['tab-button', { active: activeTab === 'detail' }]" @click="activeTab = 'detail'">详情</button>
      <button :class="['tab-button', { active: activeTab === 'logs' }]" @click="activeTab = 'logs'">执行日志</button>
    </div>

    <!-- 详情 Tab -->
    <div v-if="activeTab === 'detail'" class="tab-content">
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
      <div class="info-row">
        <span class="info-label">计划任务</span>
        <span class="info-value">{{ task.isPlan ? '是' : '否' }}</span>
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
        <span class="info-label">所属项目</span>
        <span class="info-value">
          {{ projectStore.projects.find((p) => p._id === task!.projectId)?.name ?? task!.projectId }}
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">优先级</span>
        <span class="info-value">{{ task.priority }}</span>
      </div>
      <div v-if="task.claudeSessionId" class="info-row">
        <span class="info-label">Claude Session ID</span>
        <span class="info-value session-id">
          <code>{{ task.claudeSessionId }}</code>
          <button class="glass-button btn-sm" @click="copySessionId" title="复制">📋</button>
        </span>
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

    <!-- 继续执行按钮（仅对被停止的任务显示） -->
    <div v-if="canResume" class="resume-prompt glass">
      <p class="resume-text">
        <span class="resume-icon">⚠️</span>
        该任务已被停止，您可以继续执行
      </p>
      <button class="glass-button primary" @click="handleResume" :disabled="isResuming">
        {{ isResuming ? '继续中...' : '继续执行' }}
      </button>
    </div>

    <!-- 子任务列表 -->
    <section v-if="childTasks.length" class="child-tasks">
      <h2 class="section-title">子任务</h2>
      <ul class="child-task-list">
        <TaskListItem
          v-for="ct in childTasks"
          :key="ct._id"
          mode="compact"
          :task="ct"
          @edit="handleEditChildTask"
          @delete="deletingChildTaskId = $event"
        />
      </ul>
    </section>

    <section v-if="task.planOutput" class="plan-output">
      <h2 class="section-title">开发计划</h2>
      <div class="plan-panel glass">
        <pre class="plan-content">{{ task.planOutput }}</pre>
        <div class="plan-actions">
          <button class="glass-button primary" @click="showPlanFullscreen = true">全屏查看</button>
        </div>
      </div>
    </section>

    <section class="transitions">
      <h2 class="section-title">状态流转</h2>
      <div class="transitions-panel glass">
        <TaskStatusActions :status="task.status" :task="task" @transition="handleTransition" />
      </div>
    </section>
    </div>

    <!-- 执行日志 Tab -->
    <div v-if="activeTab === 'logs'" class="tab-content execution-logs">
      <div class="logs-sidebar glass">
        <div
          v-for="(phase, idx) in executionPhases"
          :key="idx"
          :class="['phase-item', { active: selectedPhaseIndex === idx }]"
          @click="selectedPhaseIndex = idx"
        >
          <div class="phase-header">
            <StatusBadge :status="phase.status" />
            <span v-if="!phase.endedAt" class="phase-badge">当前</span>
          </div>
          <div class="phase-time">{{ formatPhaseTime(phase) }}</div>
        </div>
      </div>
      <div class="logs-content glass">
        <div v-if="selectedPhase" class="phase-detail">
          <div class="phase-detail-header">
            <h3>{{ STATUS_LABEL[selectedPhase.status] }}</h3>
            <span class="phase-detail-time">{{ formatPhaseTime(selectedPhase) }}</span>
          </div>
          <div class="phase-detail-body">
            <template v-if="selectedPhase.status === 'developing' || selectedPhase.status === 'planning'">
              <div class="content-label-with-control">
	                <span class="content-label">{{ selectedPhase.status === 'planning' ? '计划执行日志' : '开发日志' }}</span>
	                <label class="tool-call-filter">
	                  <input type="checkbox" v-model="hideToolCalls" />
	                  <span>隐藏工具调用</span>
	                  <span v-if="hideToolCalls && getHiddenToolCallsCount(selectedPhase) > 0" class="hidden-count">
	                    (已隐藏 {{ getHiddenToolCallsCount(selectedPhase) }} 条)
	                  </span>
	                </label>
	              </div>
              <div v-if="getPhaseLogs(selectedPhase).length" ref="logListRef" class="log-list">
                <div
                  v-for="(log, idx) in getPhaseLogs(selectedPhase)"
                  :key="idx"
                  :class="['log-entry', log.level]"
                >
                  <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                  <pre class="log-message">{{ log.message }}</pre>
                </div>
              </div>
              <div v-else class="content-empty">暂无日志</div>
            </template>

            <template v-else-if="selectedPhase.status === 'plan_reviewing'">
              <div class="content-label">开发计划</div>
              <pre class="content-block">{{ selectedPhase.result || task.planOutput || '无计划内容' }}</pre>
            </template>

            <template v-else-if="selectedPhase.status === 'reviewing'">
              <div class="content-label">开发结果</div>
              <pre class="content-block">{{ selectedPhase.result || task.result || '无结果内容' }}</pre>
            </template>

            <template v-else>
              <div class="content-empty">该阶段暂无详细内容</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="showDeleteConfirm"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />

    <ConfirmDialog
      title="确认删除子任务"
      message="删除子任务后不可恢复，确定要继续吗？"
      :visible="deletingChildTaskId !== null"
      @confirm="handleDeleteChildTask(deletingChildTaskId!)"
      @cancel="deletingChildTaskId = null"
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

.session-id {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  background: rgba(0, 0, 0, 0.04);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  word-break: break-all;
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

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.log-list {
  max-height: 480px;
  overflow-y: auto;
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

.plan-output {
  margin-top: var(--space-2xl);
}

.plan-panel {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.plan-content {
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-text);
  margin: 0;
  background: rgba(0, 0, 0, 0.04);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border-subtle);
}

.plan-actions {
  display: flex;
  justify-content: flex-end;
}

.plan-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}

.plan-fullscreen-content {
  width: 100%;
  max-width: 960px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.plan-fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.plan-fullscreen-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.plan-fullscreen-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  white-space: pre-wrap;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--color-text);
  margin: 0;
  background: transparent;
}

.tabs-bar {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xl);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.tab-button {
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.tab-button:hover {
  color: var(--color-text);
}

.tab-button.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.execution-logs {
  display: flex;
  gap: var(--space-lg);
  min-height: 500px;
}

.logs-sidebar {
  width: 280px;
  flex-shrink: 0;
  padding: var(--space-md);
  max-height: 600px;
  overflow-y: auto;
}

.phase-item {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  margin-bottom: var(--space-sm);
}

.phase-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.phase-item.active {
  background: rgba(0, 0, 0, 0.06);
  border-left: 3px solid var(--color-accent);
}

.phase-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.phase-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-accent);
  background: rgba(0, 122, 255, 0.1);
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-full);
}

.phase-time {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.logs-content {
  flex: 1;
  padding: var(--space-lg);
  min-height: 500px;
  overflow-y: auto;
}

.phase-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.phase-detail-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.phase-detail-time {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.content-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: var(--space-md);
}

.content-label-with-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.tool-call-filter {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.tool-call-filter input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
}

.tool-call-filter span {
  line-height: 1;
}

.tool-call-filter .hidden-count {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
}

.content-empty {
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  padding: var(--space-xl) 0;
  text-align: center;
}

.content-block {
  background: rgba(0, 0, 0, 0.04);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  white-space: pre-wrap;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  border: 1px solid var(--glass-border-subtle);
  max-height: 480px;
  overflow-y: auto;
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

  .execution-logs {
    flex-direction: column;
  }

  .logs-sidebar {
    width: 100%;
    max-height: 200px;
  }

  .transitions-panel :deep(.actions) {
    flex-direction: column;
  }

  .transitions-panel :deep(.actions button) {
    width: 100%;
    min-height: 44px;
  }
}

/* ── Session ID 显示 ── */
.session-id {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.session-id code {
  background: rgba(0, 0, 0, 0.04);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  word-break: break-all;
  border: 1px solid var(--glass-border-subtle);
}

.session-id .btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  min-height: 28px;
}

/* ── 继续执行提示 ── */
.resume-prompt {
  padding: var(--space-lg);
  margin-top: var(--space-xl);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  background: rgba(255, 149, 10, 0.08);
  border: 1px solid rgba(255, 149, 10, 0.3);
}

.resume-text {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.resume-icon {
  font-size: 1.125rem;
}

.resume-prompt .glass-button {
  white-space: nowrap;
}

@media (max-width: 640px) {
  .resume-prompt {
    flex-direction: column;
    align-items: stretch;
  }

  .resume-text {
    justify-content: center;
  }
}
</style>
