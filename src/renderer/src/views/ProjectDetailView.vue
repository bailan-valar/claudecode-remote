<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, nextTick, computed, defineOptions } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import ProjectForm from '../components/ProjectForm.vue'
import TaskEditDialog from '../components/TaskEditDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import TaskListItem from '../components/TaskListItem.vue'
import TaskCreatePanel from '../components/TaskCreatePanel.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import TaskTreeList from '../components/TaskTreeList.vue'
import { apiClient } from '../api/index'
import type { Project, Task, LlmProvider } from '../../../shared/types'
import type { LogEntry } from '../../../main/engine/runner'
import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'
import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

defineOptions({
  name: 'ProjectDetailView'
})

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const taskStore = useTaskStore()

const projectId = route.params.id as string
const project = ref<Project | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)
const showCreateTask = ref(false)
const showTaskDialog = ref(false)
const editingTask = ref<Task | undefined>(undefined)
const activeTab = ref<'info' | 'tasks' | 'chat' | 'terminal'>('info')
const tick = ref(0)
const llmProviders = ref<LlmProvider[]>([])
const taskViewMode = ref<'list' | 'kanban'>('list')
const subtaskParentId = ref<string | null>(null)
let timerId: ReturnType<typeof setInterval> | null = null

// 控制是否隐藏聊天中的工具调用及结果（从本地存储读取偏好）
const hideChatToolCalls = ref(localStorage.getItem('hideChatToolCalls') === 'true')

// 监听变化，保存到本地存储
watch(hideChatToolCalls, (newValue) => {
  localStorage.setItem('hideChatToolCalls', String(newValue))
})

// 过滤聊天日志，隐藏工具调用和工具结果
function filterChatLogs(logs: LogEntry[]) {
  if (!hideChatToolCalls.value) return logs
  return logs.filter(log => {
    const trimmed = log.message.trim()
    return !trimmed.startsWith('[工具]') && !trimmed.startsWith('[工具结果]')
  })
}

// 计算被隐藏的工具调用数量
function getHiddenChatToolCallsCount(msg: ChatMessage) {
  if (!hideChatToolCalls.value) return 0
  return msg.logs.filter(log => {
    const trimmed = log.message.trim()
    return trimmed.startsWith('[工具]') || trimmed.startsWith('[工具结果]')
  }).length
}

// 获取项目的 LLM Provider
const projectLlmProvider = computed(() => {
  if (!project.value) return undefined
  if (project.value.llmProviderId) {
    return llmProviders.value.find(p => p.id === project.value!.llmProviderId)
  }
  // 回退到全局默认
  return llmProviders.value.find(p => p.isDefault)
})

// 加载 LLM Providers
async function loadLlmProviders() {
  try {
    const result = await apiClient.listLlmProviders()
    if (result.ok && result.providers) {
      llmProviders.value = result.providers
    }
  } catch (err) {
    console.warn('加载 LLM Providers 失败:', err)
  }
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

onMounted(() => {
  project.value = projectStore.projects.find((p) => p._id === projectId)
  if (!project.value) projectStore.fetch()
  taskStore.fetch(projectId)
  startTick()
  loadLlmProviders()
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

// 监听标签切换，加载聊天历史
watch(activeTab, async (newTab) => {
  if (newTab === 'chat' && project.value) {
    await loadChatHistory()
  }
})

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
  subtaskParentId.value = null
  await taskStore.fetch(projectId)
}

async function handleTaskDialogSubmit(task?: Task, changes?: Partial<Task>) {
  showTaskDialog.value = false
  editingTask.value = undefined
  if (task && changes) {
    // 编辑模式
    const result = await taskStore.update(task._id, changes)
    if (result.ok) {
      await taskStore.fetch(projectId)
    }
  } else {
    // 新增模式
    await taskStore.fetch(projectId)
  }
}

function setTaskViewMode(mode: 'list' | 'kanban') {
  taskViewMode.value = mode
}

function handleAddSubtask(taskId: string) {
  const task = taskStore.tasks.find((t) => t._id === taskId)
  if (task) {
    subtaskParentId.value = taskId
    showCreateTask.value = true
  }
}

function handleMoveTask(taskId: string, status: TaskStatus) {
  taskStore.updateStatus(taskId, status)
}

// 项目名称映射（用于任务组件）
const projectNameMap = computed(() => {
  const map = new Map<string, string>()
  if (project.value) {
    map.set(project.value._id, project.value.name)
  }
  return map
})

function openCreateTaskDialog() {
  editingTask.value = undefined
  showTaskDialog.value = true
}

function openEditTaskDialog(task: Task) {
  editingTask.value = task
  showTaskDialog.value = true
}

function closeTaskDialog() {
  showTaskDialog.value = false
  editingTask.value = undefined
}

const deletingTaskId = ref<string | null>(null)

async function handleDeleteTask(taskId: string) {
  deletingTaskId.value = null
  await taskStore.remove(taskId)
}

// TaskListItem 事件处理
function handleTaskNavigate(taskId: string) {
  router.push({ name: 'task-detail', params: { id: taskId } })
}

function handleTaskTransition(taskId: string, status: TaskStatus) {
  taskStore.updateStatus(taskId, status)
}

function handleTaskEdit(taskId: string) {
  const task = taskStore.tasks.find(t => t._id === taskId)
  if (task) {
    openEditTaskDialog(task)
  }
}

// 兼容：所有任务展平列表（用于编辑对话框等）
const sortedTasks = computed(() => {
  const list = taskStore.tasks.filter(t => t.projectId === projectId)
  return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

// ── Claude Chat ──
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  logs: LogEntry[]
  timestamp: string
  status: 'streaming' | 'done' | 'error'
}

const chatMessages = ref<ChatMessage[]>([])
const chatInput = ref('')
const chatLoading = ref(false)
const chatHistoryLoading = ref(false)
const chatSessionId = ref<string | undefined>(undefined)
const chatContainerRef = ref<HTMLElement | null>(null)
let chatLogUnsubscribe: (() => void) | null = null
let chatDoneUnsubscribe: (() => void) | null = null

function scrollChatToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

function handleChatLog(entry: LogEntry) {
  const lastMsg = chatMessages.value[chatMessages.value.length - 1]
  if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
    lastMsg.logs.push(entry)
    scrollChatToBottom()
  }
}

function handleChatDone(result: any) {
  // Promise handler already updates state; this is a fallback for SSE
  const lastMsg = chatMessages.value[chatMessages.value.length - 1]
  if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
    if (result?.success) {
      lastMsg.status = 'done'
      lastMsg.content = result.result || '（无输出）'
      if (result.sessionId) {
        chatSessionId.value = result.sessionId
      }
    } else {
      lastMsg.status = 'error'
      lastMsg.content = result?.error || '对话失败'
    }
    chatLoading.value = false
    scrollChatToBottom()
  }
}

async function handleSendChat() {
  const message = chatInput.value.trim()
  if (!message || chatLoading.value || !project.value) return

  const userMsg: ChatMessage = {
    id: Date.now().toString() + '_u',
    role: 'user',
    content: message,
    logs: [],
    timestamp: new Date().toISOString(),
    status: 'done',
  }
  chatMessages.value.push(userMsg)

  // 保存用户消息到数据库
  try {
    await apiClient.saveChatMessage({
      type: 'chat-message',
      projectId: project.value._id,
      role: 'user',
      content: message,
      timestamp: userMsg.timestamp,
      sessionId: chatSessionId.value || generateSessionId(),
      status: 'done'
    })
  } catch (err) {
    console.warn('保存用户消息失败:', err)
  }

  chatInput.value = ''
  scrollChatToBottom()

  const assistantMsg: ChatMessage = {
    id: Date.now().toString() + '_a',
    role: 'assistant',
    content: '',
    logs: [],
    timestamp: new Date().toISOString(),
    status: 'streaming',
  }
  chatMessages.value.push(assistantMsg)
  scrollChatToBottom()

  chatLoading.value = true

  try {
    const result = await apiClient.chatWithClaude(project.value._id, message, chatSessionId.value)
    if (result.ok && result.success) {
      assistantMsg.status = 'done'
      assistantMsg.content = result.result || '（无输出）'
      if (result.sessionId) {
        chatSessionId.value = result.sessionId
      }

      // 保存助手消息到数据库
      try {
        await apiClient.saveChatMessage({
          type: 'chat-message',
          projectId: project.value._id,
          role: 'assistant',
          content: assistantMsg.content,
          timestamp: assistantMsg.timestamp,
          sessionId: chatSessionId.value || generateSessionId(),
          status: 'done'
        })
      } catch (err) {
        console.warn('保存助手消息失败:', err)
      }
    } else {
      assistantMsg.status = 'error'
      assistantMsg.content = result.error || '对话失败'
    }
  } catch (err: any) {
    assistantMsg.status = 'error'
    assistantMsg.content = err.message || '请求异常'
  } finally {
    chatLoading.value = false
    scrollChatToBottom()
  }
}

// 生成会话ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 加载聊天历史
async function loadChatHistory() {
  if (!project.value) return

  chatHistoryLoading.value = true

  try {
    const result = await apiClient.getChatHistory(project.value._id)
    if (result.ok && result.messages) {
      chatMessages.value = result.messages.map((msg: any) => ({
        id: msg._id || Date.now().toString(),
        role: msg.role,
        content: msg.content,
        logs: msg.logs || [],
        timestamp: msg.timestamp,
        status: msg.status || 'done'
      }))

      if (result.sessionId) {
        chatSessionId.value = result.sessionId
      }

      scrollChatToBottom()
    }
  } catch (err) {
    console.warn('加载聊天历史失败:', err)
  } finally {
    chatHistoryLoading.value = false
  }
}

async function clearChat() {
  chatMessages.value = []
  chatSessionId.value = undefined

  if (!project.value) return

  try {
    await apiClient.clearChatHistory(project.value._id)
  } catch (err) {
    console.warn('清除聊天历史失败:', err)
  }
}

// ── Terminal ──
interface TerminalCommand {
  id: string
  command: string
  output: string
  error: string
  exitCode: number
  duration: number
  timestamp: string
}

const terminalCommands = ref<TerminalCommand[]>([])
const terminalInput = ref('')
const terminalLoading = ref(false)
const terminalContainerRef = ref<HTMLElement | null>(null)

function scrollTerminalToBottom() {
  nextTick(() => {
    if (terminalContainerRef.value) {
      terminalContainerRef.value.scrollTop = terminalContainerRef.value.scrollHeight
    }
  })
}

async function handleExecuteCommand() {
  const command = terminalInput.value.trim()
  if (!command || terminalLoading.value || !project.value) return

  const cmdId = Date.now().toString()
  terminalCommands.value.push({
    id: cmdId,
    command,
    output: '',
    error: '',
    exitCode: 0,
    duration: 0,
    timestamp: new Date().toISOString(),
  })
  terminalInput.value = ''
  scrollTerminalToBottom()

  terminalLoading.value = true

  try {
    const result = await apiClient.executeTerminalCommand(project.value._id, command)
    const lastCmd = terminalCommands.value[terminalCommands.value.length - 1]
    if (lastCmd && lastCmd.id === cmdId) {
      lastCmd.output = result.stdout || ''
      lastCmd.error = result.stderr || ''
      lastCmd.exitCode = result.exitCode ?? 0
      lastCmd.duration = result.duration ?? 0
      if (!result.ok && result.error) {
        lastCmd.error += result.error
      }
    }
  } catch (err: any) {
    const lastCmd = terminalCommands.value[terminalCommands.value.length - 1]
    if (lastCmd && lastCmd.id === cmdId) {
      lastCmd.error = err.message || '执行命令失败'
      lastCmd.exitCode = -1
    }
  } finally {
    terminalLoading.value = false
    scrollTerminalToBottom()
  }
}

function clearTerminal() {
  terminalCommands.value = []
}

onMounted(() => {
  project.value = projectStore.projects.find((p) => p._id === projectId)
  if (!project.value) projectStore.fetch()
  taskStore.fetch(projectId)
  startTick()

  chatLogUnsubscribe = apiClient.onClaudeChatLog(handleChatLog)
  chatDoneUnsubscribe = apiClient.onClaudeChatDone(handleChatDone)

  // 加载聊天历史
  loadChatHistory()

  // 监听悬浮按钮的点击事件
  window.addEventListener('open-task-create', openCreateTaskDialog)
})

onUnmounted(() => {
  stopTick()
  chatLogUnsubscribe?.()
  chatDoneUnsubscribe?.()

  // 移除事件监听
  window.removeEventListener('open-task-create', openCreateTaskDialog)
})
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
          任务列表（{{ sortedTasks.length }}）
        </button>
        <button
          class="tab-button"
          :class="{ active: activeTab === 'chat' }"
          @click="activeTab = 'chat'"
        >
          Claude 对话
        </button>
        <button
          class="tab-button"
          :class="{ active: activeTab === 'terminal' }"
          @click="activeTab = 'terminal'"
        >
          终端
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
          <span class="info-value">{{ projectLlmProvider?.name || '全局默认' }}</span>
        </div>
        <div v-if="projectLlmProvider" class="info-row">
          <span class="info-label">Provider 类型</span>
          <span class="info-value">{{ projectLlmProvider.type }}</span>
        </div>
        <div v-if="projectLlmProvider?.baseUrl" class="info-row">
          <span class="info-label">Base URL</span>
          <span class="info-value mono">{{ projectLlmProvider.baseUrl }}</span>
        </div>
        <div v-if="projectLlmProvider?.model" class="info-row">
          <span class="info-label">模型</span>
          <span class="info-value mono">{{ projectLlmProvider.model }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">应用访问地址</span>
          <span class="info-value mono">{{ project.siteUrl || '未配置（默认 localhost）' }}</span>
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
          <div class="tasks-header-actions">
            <!-- 视图模式切换 -->
            <div class="view-toggle">
              <button
                class="glass-button"
                :class="{ active: taskViewMode === 'list' }"
                @click="setTaskViewMode('list')"
                title="列表视图（支持树形结构）"
              >
                列表
              </button>
              <button
                class="glass-button"
                :class="{ active: taskViewMode === 'kanban' }"
                @click="setTaskViewMode('kanban')"
                title="看板视图"
              >
                看板
              </button>
            </div>
          </div>
          <button class="glass-button primary" @click="openCreateTaskDialog">+ 新建任务</button>
        </div>

        <!-- 新建任务面板 -->
        <TaskCreatePanel
          v-model:visible="showCreateTask"
          :projects="project ? [project] : []"
          :tasks="sortedTasks"
          :default-project-id="subtaskParentId ? (taskStore.tasks.find((t) => t._id === subtaskParentId)?.projectId ?? projectId) : projectId"
          :default-parent-task-id="subtaskParentId ?? undefined"
          :title="subtaskParentId ? '添加子任务' : '新建任务'"
          @submit="handleTaskCreated"
          @cancel="showCreateTask = false; subtaskParentId = null"
        />

        <div v-if="sortedTasks.length">
          <!-- 列表视图（支持树形结构） -->
          <TaskTreeList
            v-if="taskViewMode === 'list'"
            :tasks="sortedTasks"
            :project-name-map="projectNameMap"
            :tick="tick"
            mode="compact"
            @transition="handleTaskTransition"
            @edit="handleTaskEdit"
            @delete="deletingTaskId = $event"
            @add-subtask="handleAddSubtask"
          />

          <!-- 看板视图 -->
          <KanbanBoard
            v-else
            :tasks="sortedTasks"
            :project-name-map="projectNameMap"
            :tick="tick"
            @move="handleMoveTask"
            @edit="handleTaskEdit"
            @delete="deletingTaskId = $event"
            @add-subtask="handleAddSubtask"
          />
        </div>
        <p v-else class="empty">该项目暂无任务</p>
      </section>

      <!-- Claude 对话 -->
      <section v-show="activeTab === 'chat'" class="chat">
        <div class="chat-toolbar">
          <button class="glass-button" @click="clearChat">新对话</button>
          <span v-if="chatSessionId" class="session-hint">已恢复会话</span>
          <label class="tool-call-filter">
            <input type="checkbox" v-model="hideChatToolCalls" />
            <span>隐藏工具调用及结果</span>
          </label>
        </div>
        <div ref="chatContainerRef" class="chat-container glass">
          <div v-if="chatHistoryLoading" class="chat-loading">
            <p>加载聊天历史中...</p>
          </div>
          <div v-else-if="!chatMessages.length" class="chat-empty">
            <p>在此直接与 Claude 对话，支持项目上下文和工具调用。</p>
          </div>
          <div
            v-for="msg in chatMessages"
            :key="msg.id"
            :class="['chat-message', msg.role]"
          >
            <div class="chat-bubble">
              <div v-if="msg.role === 'user'" class="chat-text">
                <pre>{{ msg.content }}</pre>
              </div>
              <div v-else>
                <div v-if="msg.status === 'streaming'" class="chat-streaming">
                  <div
                    v-for="(log, idx) in filterChatLogs(msg.logs)"
                    :key="idx"
                    :class="['log-line', log.level]"
                  >
                    <span class="log-time">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
                    <pre class="log-msg">{{ log.message }}</pre>
                  </div>
                  <span v-if="chatLoading" class="typing-indicator">思考中…</span>
                  <div v-if="hideChatToolCalls && getHiddenChatToolCallsCount(msg) > 0" class="hidden-hint">
                    已隐藏 {{ getHiddenChatToolCallsCount(msg) }} 条工具调用日志
                  </div>
                </div>
                <div v-else-if="msg.status === 'error'" class="chat-error">
                  {{ msg.content }}
                </div>
                <div v-else class="chat-text">
                  <pre>{{ msg.content }}</pre>
                </div>
              </div>
            </div>
            <span class="chat-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
          </div>
        </div>
        <div class="chat-input-panel glass">
          <textarea
            v-model="chatInput"
            class="chat-input"
            rows="2"
            placeholder="输入消息，按 Ctrl+Enter 发送…"
            @keydown.ctrl.enter.prevent="handleSendChat"
          />
          <button
            class="glass-button primary"
            :disabled="chatLoading || !chatInput.trim()"
            @click="handleSendChat"
          >
            {{ chatLoading ? '发送中…' : '发送' }}
          </button>
        </div>
      </section>

      <!-- 终端 -->
      <section v-show="activeTab === 'terminal'" class="terminal">
        <div class="terminal-toolbar">
          <button class="glass-button" @click="clearTerminal">清空终端</button>
          <span v-if="project" class="terminal-path">{{ project.path }}</span>
        </div>
        <div ref="terminalContainerRef" class="terminal-container glass">
          <div v-if="!terminalCommands.length" class="terminal-empty">
            <p>在项目目录中执行终端命令。</p>
            <p class="terminal-hint">提示: 支持 npm, git, node 等常用命令</p>
          </div>
          <div
            v-for="cmd in terminalCommands"
            :key="cmd.id"
            class="terminal-command"
          >
            <div class="command-line">
              <span class="prompt">$</span>
              <span class="command">{{ cmd.command }}</span>
              <span v-if="cmd.duration > 0" class="command-duration">{{ cmd.duration }}ms</span>
            </div>
            <div v-if="cmd.output || cmd.error" class="command-output">
              <pre v-if="cmd.output" class="output-stdout">{{ cmd.output }}</pre>
              <pre v-if="cmd.error" class="output-stderr">{{ cmd.error }}</pre>
            </div>
            <div v-if="cmd.exitCode !== 0 && !cmd.error" class="command-status">
              退出码: {{ cmd.exitCode }}
            </div>
          </div>
        </div>
        <div class="terminal-input-panel glass">
          <span class="terminal-prompt">$</span>
          <input
            v-model="terminalInput"
            class="terminal-input"
            type="text"
            placeholder="输入命令，按 Enter 执行…"
            @keydown.enter.prevent="handleExecuteCommand"
            :disabled="terminalLoading"
          />
          <button
            class="glass-button primary"
            :disabled="terminalLoading || !terminalInput.trim()"
            @click="handleExecuteCommand"
          >
            {{ terminalLoading ? '执行中…' : '执行' }}
          </button>
        </div>
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

    <TaskEditDialog
      :visible="showTaskDialog"
      :task="editingTask"
      :projects="project ? [project] : []"
      :tasks="taskStore.tasks"
      :mode="editingTask ? 'edit' : 'create'"
      :default-project-id="projectId"
      @submit="handleTaskDialogSubmit"
      @cancel="closeTaskDialog"
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tasks-header-actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.view-toggle {
  display: flex;
  gap: var(--space-xs);
}

.view-toggle .glass-button {
  min-height: 36px;
  font-size: 0.875rem;
  padding: var(--space-xs) var(--space-md);
}

.view-toggle .glass-button.active {
  background: var(--color-accent);
  color: #fff;
  border-color: transparent;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0px;
}

/* ── 手机端更紧凑的间隔 ── */
@media (max-width: 640px) {
  .view-toggle .glass-button {
    min-height: 32px;
    font-size: 0.8125rem;
    padding: var(--space-xs) var(--space-sm);
  }

  .tasks-header .glass-button.primary {
    min-height: 32px;
    font-size: 0.8125rem;
    padding: var(--space-xs) var(--space-md);
  }
}

.empty {
  color: var(--color-text-secondary);
  padding: var(--space-xl);
  text-align: center;
  font-size: 0.9375rem;
}

/* ── Claude 对话 ── */
.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.session-hint {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.chat-container {
  max-height: 480px;
  min-height: 240px;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.chat-empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-2xl);
  font-size: 0.9375rem;
}

.chat-loading {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-2xl);
  font-size: 0.9375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.chat-loading::before {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.chat-message.user {
  align-items: flex-end;
}

.chat-message.assistant {
  align-items: flex-start;
}

.chat-bubble {
  max-width: 80%;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: normal;
}

.chat-message.user .chat-bubble {
  background: var(--color-accent);
  color: #fff;
}

.chat-message.assistant .chat-bubble {
  background: rgba(0, 0, 0, 0.04);
  color: var(--color-text);
  border: 1px solid var(--glass-border-subtle);
}

.chat-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: normal;
  overflow-wrap: break-word;
}

.chat-text pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
}

.chat-streaming .log-line {
  margin-bottom: var(--space-sm);
  font-size: 0.8125rem;
}

.chat-streaming .log-line:last-child {
  margin-bottom: 0;
}

.chat-streaming .log-time {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  margin-right: var(--space-sm);
  font-family: 'SF Mono', Monaco, monospace;
}

.chat-streaming .log-msg {
  white-space: pre-wrap;
  margin: 0.25rem 0 0 0;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text);
}

.chat-streaming .log-line.error .log-msg {
  color: var(--color-error);
}

.chat-streaming .hidden-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: var(--space-xs);
  opacity: 0.8;
}

.typing-indicator {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin-top: var(--space-sm);
  display: inline-block;
  animation: pulse 1.5s infinite;
}

.chat-error {
  color: var(--color-error);
  font-size: 0.9375rem;
}

.chat-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.tool-call-filter {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
  margin-left: auto;
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

.chat-input-panel {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  resize: vertical;
  min-height: 44px;
  max-height: 120px;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.9375rem;
  line-height: 1.5;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.chat-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.chat-input-panel .glass-button {
  min-height: 44px;
  padding: var(--space-sm) var(--space-lg);
}

/* ── Terminal ── */
.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.terminal-path {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  font-family: 'SF Mono', Monaco, monospace;
}

.terminal-container {
  max-height: 480px;
  min-height: 240px;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'SF Mono', Monaco, monospace;
}

.terminal-empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--space-2xl);
  font-size: 0.9375rem;
}

.terminal-hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-top: var(--space-sm);
}

.terminal-command {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.command-line {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.9375rem;
}

.prompt {
  color: #4ec9b0;
  font-weight: 600;
}

.command {
  color: #dcdcaa;
  flex: 1;
  word-break: break-all;
}

.command-duration {
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
}

.command-output {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding-left: var(--space-lg);
}

.output-stdout,
.output-stderr {
  margin: 0;
  white-space: pre-wrap;
  font-size: 0.875rem;
  line-height: 1.5;
  word-break: break-word;
}

.output-stdout {
  color: #d4d4d4;
}

.output-stderr {
  color: #f48771;
}

.command-status {
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  padding-left: var(--space-lg);
}

.terminal-input-panel {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  align-items: center;
  background: #2d2d2d;
  border: 1px solid #3e3e3e;
}

.terminal-prompt {
  color: #4ec9b0;
  font-weight: 600;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 1rem;
}

.terminal-input {
  flex: 1;
  padding: var(--space-sm) var(--space-md);
  font-size: 0.9375rem;
  line-height: 1.5;
  border-radius: var(--radius-md);
  border: 1px solid #3e3e3e;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'SF Mono', Monaco, monospace;
  outline: none;
  transition: border-color var(--transition-fast);
}

.terminal-input:focus {
  border-color: #4ec9b0;
}

.terminal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.terminal-input-panel .glass-button {
  min-height: 40px;
  padding: var(--space-sm) var(--space-lg);
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

  .chat-message.user .chat-bubble {
    max-width: 98%;
  }

  .chat-message.assistant .chat-bubble {
    max-width: 90%;
  }

  .chat-input-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .chat-input-panel .glass-button {
    width: 100%;
    min-height: 44px;
  }

  .terminal-input-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .terminal-input-panel .glass-button {
    width: 100%;
    min-height: 44px;
  }

  .terminal-container {
    max-height: 360px;
    min-height: 180px;
  }
}
</style>
