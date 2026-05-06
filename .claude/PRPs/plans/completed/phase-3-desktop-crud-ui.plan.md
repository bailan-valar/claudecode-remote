# Plan: Phase 3 — 桌面 CRUD UI 完善

## Summary
完成桌面端任务与项目的完整 CRUD 体验：任务状态流转按钮（planned→pending→developing→reviewing→completed/closed）、按项目/状态过滤、编辑/删除、详情页面、本地路径文件选择器、首页数据看板。目标是从"能创建"升级到"能完整操作一个任务生命周期"。

## User Story
As a ClaudeCode Remote 桌面端用户，
I want 在桌面端完成任务的创建、编辑、过滤、状态流转和删除，以及项目的管理，
So that 我可以在不写代码的情况下完整操作一个任务从规划到完成的完整生命周期。

## Problem → Solution
当前任务和项目页面仅支持列表浏览和创建，没有编辑、删除、状态流转、过滤和详情功能，且项目路径只能手动输入。→ 补充完整的 CRUD UI、状态机按钮、过滤器、详情页、文件选择器和首页统计看板。

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/claudecode-remote.prd.md`
- **PRD Phase**: Phase 3: 桌面 CRUD UI 完善
- **Estimated Files**: 20 (10 新建 + 10 修改)

---

## UX Design

### Before
```
┌─────────────────────────────────────────────────────────────┐
│ 首页          项目          任务           [username] 注销  │
├─────────────────────────────────────────────────────────────┤
│ 任务                                          [+ 新建任务]  │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ planned   实现登录功能      project-id-1               │  │
│ │ pending   添加任务列表      project-id-2               │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ [只能浏览，无法编辑、删除、流转状态、过滤、查看详情]          │
└─────────────────────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────────────────────┐
│ 首页          项目          任务           [username] 注销  │
├─────────────────────────────────────────────────────────────┤
│ 任务                        [全部] [状态▼]  [+ 新建任务]    │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [规划中]  实现登录功能                                    │
│ │           所属：MyProject    创建：2024-01-15            │
│ │ [开始开发] [编辑] [删除]  [查看详情 →]                    │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [开发中]  添加任务列表                                    │
│ │           所属：MyProject                                │
│ │ [提交审核] [编辑] [删除]                                  │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [待审核]  修复同步bug                                     │
│ │           所属：AnotherProj                              │
│ │ [完成] [退回] [编辑] [删除]                               │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ 点击任务标题 → TaskDetailView（完整信息 + 编辑 + 状态流转）  │
└─────────────────────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 任务列表 | 纯文本列表 | 卡片列表 + 状态徽章 + 操作按钮 | 每个任务可流转/编辑/删除/查看详情 |
| 任务过滤 | 无 | 项目过滤 + 状态过滤 | 组合过滤，支持"全部" |
| 项目列表 | 纯文本列表 | 卡片列表 + 编辑/删除/查看详情 | 点击名称进入详情 |
| 项目路径 | 手动输入文本 | 输入框 + [选择文件夹] 按钮 | 调用系统文件选择器 |
| 首页 | 仅同步状态 | 同步状态 + 统计卡片（项目数/任务数分布） | 一目了然 |
| 路由 | /tasks /projects | 新增 /tasks/:id /projects/:id | 详情页独立路由 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/shared/constants.ts` | 1-23 | TASK_STATUS / TASK_PRIORITY 值和类型 |
| P0 | `src/shared/types.ts` | 1-51 | Task / Project / BaseDoc 接口 |
| P0 | `src/renderer/src/stores/useTaskStore.ts` | 1-45 | Pinia setup store 模式，不可变更新 |
| P0 | `src/renderer/src/stores/useProjectStore.ts` | 1-39 | Project store CRUD 模式 |
| P0 | `src/preload/index.ts` | 1-47 | IPC API 类型和暴露方式 |
| P0 | `src/main/ipc.ts` | 1-163 | IPC handler 注册模式（removeHandler + handle） |
| P1 | `src/renderer/src/router/index.ts` | 1-27 | Hash 路由 + 懒加载 + auth guard |
| P1 | `src/renderer/src/views/TasksView.vue` | 1-52 | 当前任务页面结构 |
| P1 | `src/renderer/src/views/ProjectsView.vue` | 1-40 | 当前项目页面结构 |
| P1 | `src/renderer/src/components/TaskForm.vue` | 1-53 | 表单组件模式 |
| P1 | `src/renderer/src/components/ProjectForm.vue` | 1-44 | 项目表单组件模式 |
| P1 | `src/renderer/src/style.css` | 1-40 | CSS design tokens |
| P2 | `src/renderer/src/views/HomeView.vue` | 1-160 | 首页卡片样式参考 |
| P2 | `src/renderer/src/App.vue` | 1-42 | 布局结构 |

---

## External Documentation

No external research needed — feature uses established internal patterns.

---

## Patterns to Mirror

### PINIA_SETUP_STORE
// SOURCE: `src/renderer/src/stores/useTaskStore.ts:1-45`
```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task } from '../../../shared/types'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)

  async function fetch() {
    isLoading.value = true
    const result = await window.api.listTasks()
    if (result.ok) tasks.value = result.tasks
    isLoading.value = false
  }

  async function create(doc: Parameters<typeof window.api.createTask>[0]) {
    const result = await window.api.createTask(doc)
    if (result.ok) tasks.value = [...tasks.value, result.task]
    return result
  }

  async function remove(id: string) {
    const result = await window.api.deleteTask(id)
    if (result.ok) {
      tasks.value = tasks.value.filter((t) => t._id !== id)
    }
    return result
  }

  return { tasks, isLoading, fetch, create, remove }
})
```

### IPC_HANDLER_REGISTER
// SOURCE: `src/main/ipc.ts:71-112`
```ts
ipcMain.removeHandler('project:list')
ipcMain.handle('project:list', async () => {
  const db = syncManager.getLocalDb()
  if (!db) return { ok: false, error: '未登录' }
  const repo = createProjectRepository(db)
  const projects = await repo.findAll()
  return { ok: true, projects }
})
```

### IPC_HANDLER_PRELOAD
// SOURCE: `src/preload/index.ts:28-34`
```ts
listProjects: () => ipcRenderer.invoke('project:list'),
createProject: (doc: Omit<Project, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) =>
  ipcRenderer.invoke('project:create', doc),
```

### FORM_COMPONENT
// SOURCE: `src/renderer/src/components/TaskForm.vue:1-53`
```ts
<script setup lang="ts">
const props = defineProps<{ projects: Project[] }>()
const emit = defineEmits<{ submit: []; cancel: [] }>()
const taskStore = useTaskStore()

const title = ref('')
// ...

async function handleSubmit() {
  const result = await taskStore.create({ ... })
  if (result.ok) { /* clear + emit */ }
}
</script>
```

### VUE_ROUTE_LAZY
// SOURCE: `src/renderer/src/router/index.ts:1-27`
```ts
import { createRouter, createWebHashHistory } from 'vue-router'

const TasksView = () => import('../views/TasksView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/tasks', name: 'tasks', component: TasksView },
  ],
})
```

### ERROR_ENVELOPE
// SOURCE: `src/main/ipc.ts:36-46` 和 `src/preload/index.ts`
```ts
// main
return { ok: true, projects }
return { ok: false, error: '未登录' }

// preload 类型通过 typeof api 自动推导
```

### CSS_DESIGN_TOKENS
// SOURCE: `src/renderer/src/style.css:1-18`
```css
:root {
  --color-surface: #ffffff;
  --color-text: #1a1a1a;
  --color-muted: #666666;
  --color-accent: #2563eb;
  --color-success: #16a34a;
  --color-error: #dc2626;
  --color-border: #e5e7eb;
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --radius: 0.5rem;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/renderer/src/utils/taskTransitions.ts` | CREATE | 任务状态机：当前状态→允许的下个状态 |
| `src/renderer/src/utils/__tests__/taskTransitions.test.ts` | CREATE | 状态机单元测试 |
| `src/renderer/src/components/StatusBadge.vue` | CREATE | 状态中文标签 + 颜色映射 |
| `src/renderer/src/components/TaskStatusActions.vue` | CREATE | 当前状态对应的流转按钮组 |
| `src/renderer/src/components/TaskFilters.vue` | CREATE | 项目 + 状态组合过滤器 |
| `src/renderer/src/components/ConfirmDialog.vue` | CREATE | 删除确认弹窗 |
| `src/renderer/src/components/EmptyState.vue` | CREATE | 空列表占位 |
| `src/renderer/src/views/TaskDetailView.vue` | CREATE | 任务详情页（编辑+状态+删除） |
| `src/renderer/src/views/ProjectDetailView.vue` | CREATE | 项目详情/设置页 |
| `src/renderer/src/views/HomeView.vue` | UPDATE | 增加统计看板卡片 |
| `src/renderer/src/views/TasksView.vue` | UPDATE | 集成过滤、状态按钮、删除、详情链接 |
| `src/renderer/src/views/ProjectsView.vue` | UPDATE | 集成编辑、删除、详情链接 |
| `src/renderer/src/components/TaskForm.vue` | UPDATE | 支持编辑模式（initialTask prop） |
| `src/renderer/src/components/ProjectForm.vue` | UPDATE | 支持编辑模式 + 路径选择按钮 |
| `src/renderer/src/stores/useTaskStore.ts` | UPDATE | 补充 update() 方法、统计 computed |
| `src/renderer/src/router/index.ts` | UPDATE | 添加 /tasks/:id /projects/:id |
| `src/main/ipc.ts` | UPDATE | 注册 dialog:openDirectory handler |
| `src/preload/index.ts` | UPDATE | 暴露 selectDirectory API |

## NOT Building

- ❌ LLM 配置 UI（provider/model/apiKey 等）— Phase 5
- ❌ 日志查看器（logs 数组渲染）— Phase 9
- ❌ 子任务树渲染（parentTaskId）— Phase 8
- ❌ 引擎集成（developing→reviewing 自动流转）— Phase 4
- ❌ 移动端适配 — Phase 7
- ❌ 任务优先级排序/拖拽 — 超出 Phase 3 范围

---

## Step-by-Step Tasks

### Task 1: 任务状态机工具函数
- **ACTION**: 创建 `src/renderer/src/utils/taskTransitions.ts`
- **IMPLEMENT**: 定义状态流转规则 + 中文标签 + 颜色映射
  ```ts
  import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

  export const STATUS_LABEL: Record<TaskStatus, string> = {
    planned: '规划中',
    pending: '待开发',
    developing: '开发中',
    reviewing: '待审核',
    completed: '已完成',
    closed: '已关闭',
  }

  export const STATUS_COLOR: Record<TaskStatus, string> = {
    planned: '#6b7280',
    pending: '#2563eb',
    developing: '#d97706',
    reviewing: '#7c3aed',
    completed: '#16a34a',
    closed: '#dc2626',
  }

  // 当前状态 → 允许流转到的状态列表
  export function getAllowedNext(status: TaskStatus): TaskStatus[] {
    switch (status) {
      case 'planned':
        return [TASK_STATUS.PENDING]
      case 'pending':
        return [TASK_STATUS.DEVELOPING]
      case 'developing':
        return [TASK_STATUS.REVIEWING]
      case 'reviewing':
        return [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING, TASK_STATUS.CLOSED]
      case 'completed':
        return []
      case 'closed':
        return []
    }
  }

  // 流转按钮的中文标签
  export const TRANSITION_LABEL: Record<string, string> = {
    pending: '开始开发',
    developing: '提交审核',
    reviewing: '提交审核',
    completed: '完成',
    closed: '关闭',
  }
  ```
- **MIRROR**: N/A — 纯工具函数，无需 UI 模式
- **IMPORTS**: `TASK_STATUS`, `TaskStatus`
- **GOTCHA**: `reviewing` 可以退回 `pending`（退回重开发），不是线性单向的
- **VALIDATE**: 检查每个状态的输出数量：planned→1, pending→1, developing→1, reviewing→3, completed→0, closed→0

### Task 2: 状态机单元测试
- **ACTION**: 创建 `src/renderer/src/utils/__tests__/taskTransitions.test.ts`
- **IMPLEMENT**:
  ```ts
  import { describe, test, expect } from 'vitest'
  import { getAllowedNext, STATUS_LABEL } from '../taskTransitions'
  import { TASK_STATUS } from '../../../shared/constants'

  describe('getAllowedNext', () => {
    test('planned can only go to pending', () => {
      expect(getAllowedNext('planned')).toEqual([TASK_STATUS.PENDING])
    })
    test('pending can only go to developing', () => {
      expect(getAllowedNext('pending')).toEqual([TASK_STATUS.DEVELOPING])
    })
    test('developing can only go to reviewing', () => {
      expect(getAllowedNext('developing')).toEqual([TASK_STATUS.REVIEWING])
    })
    test('reviewing can go to completed, pending, or closed', () => {
      expect(getAllowedNext('reviewing')).toEqual([
        TASK_STATUS.COMPLETED,
        TASK_STATUS.PENDING,
        TASK_STATUS.CLOSED,
      ])
    })
    test('completed has no next states', () => {
      expect(getAllowedNext('completed')).toEqual([])
    })
    test('closed has no next states', () => {
      expect(getAllowedNext('closed')).toEqual([])
    })
  })

  describe('STATUS_LABEL', () => {
    test('all statuses have Chinese labels', () => {
      Object.values(TASK_STATUS).forEach((s) => {
        expect(STATUS_LABEL[s]).toBeTruthy()
      })
    })
  })
  ```
- **MIRROR**: `Repository` 测试模式（AAA）
- **IMPORTS**: `vitest`, `taskTransitions`, `TASK_STATUS`
- **GOTCHA**: 测试文件路径含 `__tests__` 子目录
- **VALIDATE**: `npm run test` or `npx vitest run src/renderer/src/utils/__tests__/taskTransitions.test.ts`

### Task 3: 状态徽章组件
- **ACTION**: 创建 `src/renderer/src/components/StatusBadge.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import type { TaskStatus } from '../../../shared/constants'
  import { STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

  defineProps<{ status: TaskStatus }>()
  </script>

  <template>
    <span class="badge" :style="{ backgroundColor: STATUS_COLOR[status] + '20', color: STATUS_COLOR[status] }">
      {{ STATUS_LABEL[status] }}
    </span>
  </template>

  <style scoped>
  .badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    white-space: nowrap;
  }
  </style>
  ```
- **MIRROR**: 组件使用 `defineProps<{ status: TaskStatus }>()` — 参见 `TaskForm.vue:6`
- **IMPORTS**: `TaskStatus`, `STATUS_LABEL`, `STATUS_COLOR`
- **GOTCHA**: 背景色用主色 + `20` 十六进制透明度（约 12%），文字用主色全不透明
- **VALIDATE**: 在 TaskDetailView 中引用后渲染 6 个状态各一次

### Task 4: 任务状态流转按钮组
- **ACTION**: 创建 `src/renderer/src/components/TaskStatusActions.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import type { TaskStatus } from '../../../shared/constants'
  import { getAllowedNext, TRANSITION_LABEL } from '../utils/taskTransitions'

  const props = defineProps<{ status: TaskStatus; disabled?: boolean }>()
  const emit = defineEmits<{ transition: [status: TaskStatus] }>()

  const nextStates = computed(() => getAllowedNext(props.status))
  </script>

  <template>
    <div class="actions">
      <button
        v-for="s in nextStates"
        :key="s"
        class="btn-primary"
        :disabled="disabled"
        @click="emit('transition', s)"
      >
        {{ TRANSITION_LABEL[s] || s }}
      </button>
    </div>
  </template>

  <style scoped>
  .actions { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
  .btn-primary {
    padding: var(--space-sm) var(--space-md);
    border: none;
    border-radius: var(--radius);
    background: var(--color-accent);
    color: white;
    font-size: 0.875rem;
    transition: opacity 0.2s;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
  ```
- **MIRROR**: 组件 props/emit 模式 — 参见 `TaskForm.vue:6-7`
- **IMPORTS**: `computed` from `vue`, `TaskStatus`, `getAllowedNext`, `TRANSITION_LABEL`
- **GOTCHA**: `reviewing` 状态有 3 个按钮（完成、退回、关闭），需要 flex-wrap 防止溢出
- **VALIDATE**: reviewing 状态渲染 3 个按钮；completed/closed 不渲染按钮

### Task 5: 任务过滤器组件
- **ACTION**: 创建 `src/renderer/src/components/TaskFilters.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import type { TaskStatus } from '../../../shared/constants'
  import { TASK_STATUS } from '../../../shared/constants'
  import type { Project } from '../../../shared/types'
  import { STATUS_LABEL } from '../utils/taskTransitions'

  const props = defineProps<{
    projects: Project[]
    selectedProjectId: string | null
    selectedStatus: TaskStatus | null
  }>()
  const emit = defineEmits<{
    updateProject: [id: string | null]
    updateStatus: [status: TaskStatus | null]
  }>()
  </script>

  <template>
    <div class="filters">
      <select
        :value="selectedProjectId ?? ''"
        @change="emit('updateProject', ($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">全部项目</option>
        <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
      </select>
      <select
        :value="selectedStatus ?? ''"
        @change="emit('updateStatus', ($event.target as HTMLSelectElement).value as TaskStatus || null)"
      >
        <option value="">全部状态</option>
        <option v-for="s in Object.values(TASK_STATUS)" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
      </select>
    </div>
  </template>

  <style scoped>
  .filters { display: flex; gap: var(--space-sm); }
  .filters select { padding: var(--space-sm); font-size: 0.875rem; border-radius: var(--radius); border: 1px solid var(--color-border); }
  </style>
  ```
- **MIRROR**: 表单 select 模式 — 参见 `TaskForm.vue:35-38`
- **IMPORTS**: `TaskStatus`, `TASK_STATUS`, `Project`, `STATUS_LABEL`
- **GOTCHA**: `value` 用 `''` 代表 null，change 事件判空转回 `null`
- **VALIDATE**: 选择项目后父组件收到正确的 projectId；选择"全部"收到 `null`

### Task 6: 确认弹窗组件
- **ACTION**: 创建 `src/renderer/src/components/ConfirmDialog.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  defineProps<{ title: string; message: string; visible: boolean }>()
  const emit = defineEmits<{ confirm: []; cancel: [] }>()
  </script>

  <template>
    <Teleport to="body">
      <div v-if="visible" class="overlay" @click.self="emit('cancel')">
        <div class="dialog">
          <h3>{{ title }}</h3>
          <p>{{ message }}</p>
          <div class="actions">
            <button class="btn-danger" @click="emit('confirm')">确认</button>
            <button class="btn-secondary" @click="emit('cancel')">取消</button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>

  <style scoped>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  .dialog {
    background: var(--color-surface); border-radius: var(--radius);
    padding: var(--space-lg); min-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .dialog h3 { margin-bottom: var(--space-sm); font-size: 1rem; }
  .dialog p { margin-bottom: var(--space-lg); color: var(--color-muted); font-size: 0.875rem; }
  .actions { display: flex; gap: var(--space-sm); justify-content: flex-end; }
  .btn-danger { padding: var(--space-sm) var(--space-md); border: none; border-radius: var(--radius); background: var(--color-error); color: white; font-size: 0.875rem; }
  .btn-secondary { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.875rem; }
  </style>
  ```
- **MIRROR**: 组件 props/emit 模式
- **IMPORTS**: `Teleport`
- **GOTCHA**: 使用 `Teleport to="body"` 避免被父容器 overflow:hidden 裁剪；点击遮罩关闭
- **VALIDATE**: 点击"取消"和遮罩都关闭弹窗；点击"确认"触发 confirm 事件

### Task 7: 空状态组件
- **ACTION**: 创建 `src/renderer/src/components/EmptyState.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  defineProps<{ message?: string }>()
  </script>

  <template>
    <div class="empty">
      <p>{{ message ?? '暂无数据' }}</p>
    </div>
  </template>

  <style scoped>
  .empty {
    text-align: center; padding: var(--space-xl); color: var(--color-muted);
  }
  </style>
  ```
- **MIRROR**: 简单展示组件
- **IMPORTS**: 无
- **GOTCHA**: 无
- **VALIDATE**: 不传 props 时显示"暂无数据"

### Task 8: 任务详情页
- **ACTION**: 创建 `src/renderer/src/views/TaskDetailView.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { onMounted, ref } from 'vue'
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
  })

  async function handleTransition(status: Task['status']) {
    if (!task.value) return
    const result = await taskStore.updateStatus(task.value._id, status)
    if (result.ok) task.value = result.task
  }

  async function handleUpdate(changes: Partial<Task>) {
    if (!task.value) return
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
        <p><strong>Prompt：</strong><pre>{{ task.prompt }}</pre></p>
        <p><strong>所属项目：</strong>{{ projectStore.projects.find(p => p._id === task.projectId)?.name ?? task.projectId }}</p>
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
  ```
- **MIRROR**: 视图页面模式 — 参见 `TasksView.vue:1-52`；详情页模式 — 类似 `HomeView.vue` 卡片布局
- **IMPORTS**: `onMounted`, `ref`, `useRoute`, `useRouter`, `useTaskStore`, `useProjectStore`, `StatusBadge`, `TaskStatusActions`, `TaskForm`, `ConfirmDialog`, `Task`
- **GOTCHA**: TaskForm 编辑模式需要 `initialTask` prop 和 `mode` prop（后续 Task 9 修改）
- **VALIDATE**: 打开 /tasks/:id 正确显示任务信息；点击"完成"状态变为 completed；点击"删除"后跳回 /tasks

### Task 9: 修改 TaskForm 支持编辑模式
- **ACTION**: 更新 `src/renderer/src/components/TaskForm.vue`
- **IMPLEMENT**: 添加 `mode` 和 `initialTask` props，编辑时预填充字段，emit 对象格式变化
  ```vue
  <script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useTaskStore } from '../stores/useTaskStore'
  import type { Project, Task } from '../../../shared/types'

  const props = defineProps<{
    projects: Project[]
    initialTask?: Task
    mode?: 'create' | 'edit'
  }>()
  const emit = defineEmits<{
    submit: [changes?: Partial<Task>]
    cancel: []
  }>()
  const taskStore = useTaskStore()

  const title = ref('')
  const description = ref('')
  const prompt = ref('')
  const projectId = ref('')

  const isEdit = computed(() => props.mode === 'edit')

  // 编辑模式下预填充
  watch(() => props.initialTask, (t) => {
    if (t) {
      title.value = t.title
      description.value = t.description ?? ''
      prompt.value = t.prompt
      projectId.value = t.projectId
    }
  }, { immediate: true })

  async function handleSubmit() {
    if (isEdit.value) {
      const changes: Partial<Task> = {}
      if (title.value !== props.initialTask!.title) changes.title = title.value
      if (description.value !== (props.initialTask!.description ?? '')) changes.description = description.value || undefined
      if (prompt.value !== props.initialTask!.prompt) changes.prompt = prompt.value
      if (projectId.value !== props.initialTask!.projectId) changes.projectId = projectId.value
      emit('submit', changes)
      return
    }
    const result = await taskStore.create({
      title: title.value,
      description: description.value || undefined,
      prompt: prompt.value,
      projectId: projectId.value,
    })
    if (result.ok) {
      title.value = ''
      description.value = ''
      prompt.value = ''
      projectId.value = ''
      emit('submit')
    }
  }
  </script>

  <template>
    <form class="task-form" @submit.prevent="handleSubmit">
      <input v-model="title" placeholder="任务标题" required />
      <select v-model="projectId" required>
        <option value="" disabled>选择项目</option>
        <option v-for="p in projects" :key="p._id" :value="p._id">{{ p.name }}</option>
      </select>
      <textarea v-model="description" placeholder="描述（可选）" rows="2" />
      <textarea v-model="prompt" placeholder="给 Claude Code 的 Prompt" rows="4" required />
      <div class="actions">
        <button type="submit">{{ isEdit ? '保存' : '创建' }}</button>
        <button type="button" @click="emit('cancel')">取消</button>
      </div>
    </form>
  </template>
  ```
- **MIRROR**: 表单组件模式 — 参见 `TaskForm.vue:1-53`
- **IMPORTS**: `watch`, `computed`, `Task`
- **GOTCHA**: 编辑模式下只 emit diff，不调用 store.create；注意 `description` 空字符串 vs undefined 的边界
- **VALIDATE**: 创建模式行为不变；编辑模式填入 initialTask 数据，保存后 emit 正确的 changes 对象

### Task 10: 项目详情页
- **ACTION**: 创建 `src/renderer/src/views/ProjectDetailView.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useProjectStore } from '../stores/useProjectStore'
  import { useTaskStore } from '../stores/useTaskStore'
  import ProjectForm from '../components/ProjectForm.vue'
  import ConfirmDialog from '../components/ConfirmDialog.vue'
  import type { Project } from '../../../shared/types'

  const route = useRoute()
  const router = useRouter()
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()

  const projectId = route.params.id as string
  const project = ref<Project | undefined>()
  const isEditing = ref(false)
  const showDeleteConfirm = ref(false)

  onMounted(() => {
    project.value = projectStore.projects.find((p) => p._id === projectId)
    if (!project.value) projectStore.fetch()
    taskStore.fetch(projectId)
  })

  async function handleUpdate(changes: Partial<Project>) {
    if (!project.value) return
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
  </script>

  <template>
    <div v-if="!project" class="loading">加载中...</div>
    <div v-else class="project-detail">
      <header>
        <h2 v-if="!isEditing">{{ project.name }}</h2>
        <div class="actions">
          <button v-if="!isEditing" @click="isEditing = true">编辑</button>
          <button v-else @click="isEditing = false">取消编辑</button>
          <button class="danger" @click="showDeleteConfirm = true">删除</button>
        </div>
      </header>

      <ProjectForm
        v-if="isEditing"
        :initial-project="project"
        mode="edit"
        @submit="handleUpdate"
        @cancel="isEditing = false"
      />

      <section v-else class="info">
        <p><strong>路径：</strong>{{ project.path }}</p>
        <p><strong>描述：</strong>{{ project.description || '无' }}</p>
        <p><strong>创建时间：</strong>{{ new Date(project.createdAt).toLocaleString() }}</p>
      </section>

      <section class="tasks">
        <h3>关联任务（{{ taskStore.filteredTasks.length }}）</h3>
        <ul v-if="taskStore.filteredTasks.length">
          <li v-for="t in taskStore.filteredTasks" :key="t._id">
            <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }">{{ t.title }}</RouterLink>
            <span class="status">{{ t.status }}</span>
          </li>
        </ul>
        <p v-else class="empty">该项目暂无任务</p>
      </section>

      <ConfirmDialog
        title="确认删除"
        message="删除项目将同时移除其所有任务，确定要继续吗？"
        :visible="showDeleteConfirm"
        @confirm="handleDelete"
        @cancel="showDeleteConfirm = false"
      />
    </div>
  </template>

  <style scoped>
  .project-detail { padding: var(--space-lg); max-width: 800px; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
  .info p { margin-bottom: var(--space-md); }
  .tasks { margin-top: var(--space-xl); }
  .tasks h3 { font-size: 1rem; margin-bottom: var(--space-sm); }
  .tasks ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
  .tasks li { display: flex; justify-content: space-between; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .empty { color: var(--color-muted); padding: var(--space-md); text-align: center; }
  </style>
  ```
- **MIRROR**: 视图页面模式 — 参见 `TasksView.vue`
- **IMPORTS**: `useRoute`, `useRouter`, `useProjectStore`, `useTaskStore`, `ProjectForm`, `ConfirmDialog`
- **GOTCHA**: `taskStore.fetch(projectId)` 会自动设置 `currentProjectId`，导致 `filteredTasks` 只显示该项目的任务
- **VALIDATE**: 打开 /projects/:id 显示项目信息 + 关联任务列表

### Task 11: 修改 ProjectForm 支持编辑和路径选择
- **ACTION**: 更新 `src/renderer/src/components/ProjectForm.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { useProjectStore } from '../stores/useProjectStore'
  import type { Project } from '../../../shared/types'

  const props = defineProps<{
    initialProject?: Project
    mode?: 'create' | 'edit'
  }>()
  const emit = defineEmits<{
    submit: [changes?: Partial<Project>]
    cancel: []
  }>()
  const projectStore = useProjectStore()

  const name = ref('')
  const path = ref('')
  const description = ref('')

  const isEdit = computed(() => props.mode === 'edit')

  watch(() => props.initialProject, (p) => {
    if (p) {
      name.value = p.name
      path.value = p.path
      description.value = p.description ?? ''
    }
  }, { immediate: true })

  async function handleSelectDirectory() {
    const result = await window.api.selectDirectory()
    if (result.ok && result.path) {
      path.value = result.path
    }
  }

  async function handleSubmit() {
    if (isEdit.value) {
      const changes: Partial<Project> = {}
      if (name.value !== props.initialProject!.name) changes.name = name.value
      if (path.value !== props.initialProject!.path) changes.path = path.value
      if (description.value !== (props.initialProject!.description ?? '')) changes.description = description.value || undefined
      emit('submit', changes)
      return
    }
    const result = await projectStore.create({
      name: name.value,
      path: path.value,
      description: description.value || undefined,
    })
    if (result.ok) {
      name.value = ''
      path.value = ''
      description.value = ''
      emit('submit')
    }
  }
  </script>

  <template>
    <form class="project-form" @submit.prevent="handleSubmit">
      <input v-model="name" placeholder="项目名称" required />
      <div class="path-input">
        <input v-model="path" placeholder="本地路径" required readonly />
        <button type="button" @click="handleSelectDirectory">选择文件夹</button>
      </div>
      <textarea v-model="description" placeholder="描述（可选）" rows="2" />
      <div class="actions">
        <button type="submit">{{ isEdit ? '保存' : '创建' }}</button>
        <button type="button" @click="emit('cancel')">取消</button>
      </div>
    </form>
  </template>

  <style scoped>
  .project-form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
  .project-form input, .project-form textarea { padding: 0.5rem; font-size: 1rem; }
  .path-input { display: flex; gap: 0.5rem; }
  .path-input input { flex: 1; }
  .actions { display: flex; gap: 0.5rem; }
  </style>
  ```
- **MIRROR**: 表单组件模式 — 参见 `ProjectForm.vue:1-44`
- **IMPORTS**: `watch`, `computed`, `Project`
- **GOTCHA**: `selectDirectory` 需要在 preload 中暴露（Task 18）；路径输入框设为 `readonly` 防止手动输入
- **VALIDATE**: 点击"选择文件夹"弹出系统文件选择器，选择后路径正确填入

### Task 12: 修改 TasksView — 集成过滤和操作
- **ACTION**: 更新 `src/renderer/src/views/TasksView.vue`
- **IMPLEMENT**:
  ```vue
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
  ```
- **MIRROR**: 列表视图模式 — 参见 `TasksView.vue:1-52`；CSS token 使用 — 参见 `style.css`
- **IMPORTS**: `useRouter`, `computed`, `TaskFilters`, `StatusBadge`, `TaskStatusActions`, `ConfirmDialog`, `EmptyState`, `TaskStatus`
- **GOTCHA**: `displayTasks` 是 computed 不是 store property，过滤在内存中做；`taskStore.updateStatus` 返回 Promise 但这里 fire-and-forget（错误已在 store 中处理）
- **VALIDATE**: 选择项目过滤后只显示该项目的任务；选择状态过滤后只显示该状态的任务；组合过滤正常；删除确认后任务消失

### Task 13: 修改 ProjectsView — 集成编辑和删除
- **ACTION**: 更新 `src/renderer/src/views/ProjectsView.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useProjectStore } from '../stores/useProjectStore'
  import ProjectForm from '../components/ProjectForm.vue'
  import ConfirmDialog from '../components/ConfirmDialog.vue'
  import EmptyState from '../components/EmptyState.vue'

  const router = useRouter()
  const projectStore = useProjectStore()
  const showForm = ref(false)
  const editingProject = ref<ReturnType<typeof projectStore['projects']['value']>[number] | null>(null)
  const deletingProjectId = ref<string | null>(null)
  </script>

  <template>
    <div class="projects-page">
      <header>
        <h2>项目</h2>
        <button @click="showForm = true">+ 新建项目</button>
      </header>

      <ProjectForm
        v-if="showForm"
        @submit="showForm = false"
        @cancel="showForm = false"
      />
      <ProjectForm
        v-else-if="editingProject"
        :initial-project="editingProject"
        mode="edit"
        @submit="projectStore.update(editingProject._id, $event); editingProject = null"
        @cancel="editingProject = null"
      />

      <div v-if="projectStore.isLoading">加载中...</div>
      <EmptyState v-else-if="projectStore.projects.length === 0" message="暂无项目，点击上方按钮创建" />
      <ul v-else class="project-list">
        <li v-for="p in projectStore.projects" :key="p._id" class="project-item">
          <div class="row">
            <RouterLink :to="{ name: 'project-detail', params: { id: p._id } }" class="name">{{ p.name }}</RouterLink>
            <span class="path">{{ p.path }}</span>
          </div>
          <p v-if="p.description" class="desc">{{ p.description }}</p>
          <div class="actions">
            <button @click="editingProject = p">编辑</button>
            <button class="danger" @click="deletingProjectId = p._id">删除</button>
          </div>
        </li>
      </ul>

      <ConfirmDialog
        title="确认删除"
        message="删除后不可恢复，确定要继续吗？"
        :visible="deletingProjectId !== null"
        @confirm="projectStore.remove(deletingProjectId!); deletingProjectId = null"
        @cancel="deletingProjectId = null"
      />
    </div>
  </template>

  <style scoped>
  .projects-page { padding: var(--space-md); }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); }
  .project-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
  .project-item { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-md); }
  .row { display: flex; align-items: center; gap: var(--space-sm); }
  .name { font-weight: 500; color: var(--color-text); text-decoration: none; }
  .name:hover { text-decoration: underline; }
  .path { color: var(--color-muted); font-size: 0.875rem; }
  .desc { margin: var(--space-sm) 0; color: #444; font-size: 0.875rem; }
  .actions { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
  .actions button { padding: var(--space-xs) var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.75rem; cursor: pointer; }
  .actions button.danger { color: var(--color-error); border-color: var(--color-error); }
  </style>
  ```
- **MIRROR**: 列表视图模式 — 参见 `ProjectsView.vue:1-40`
- **IMPORTS**: `useRouter`, `ProjectForm`, `ConfirmDialog`, `EmptyState`
- **GOTCHA**: 内联编辑和创建表单不能同时显示，用 v-if / v-else-if 互斥；`$event` 是 ProjectForm emit 的 changes 对象
- **VALIDATE**: 点击"编辑"显示编辑表单，保存后项目列表更新；点击"删除"确认后项目消失

### Task 14: 修改 HomeView — 添加统计看板
- **ACTION**: 更新 `src/renderer/src/views/HomeView.vue`
- **IMPLEMENT**: 在 sync-card 下方添加统计卡片
  ```vue
  <script setup lang="ts">
  import { onMounted } from 'vue'
  import { useSyncStore } from '../stores/useSyncStore'
  import { useProjectStore } from '../stores/useProjectStore'
  import { useTaskStore } from '../stores/useTaskStore'
  import { storeToRefs } from 'pinia'

  const store = useSyncStore()
  const { status } = storeToRefs(store)
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()

  onMounted(() => {
    projectStore.fetch()
    taskStore.fetch()
  })

  // ... existing dotClass / statusText helpers ...
  </script>

  <template>
    <main class="home">
      <h1>ClaudeCode Remote</h1>

      <!-- existing sync-card unchanged -->
      <section class="sync-card">...</section>

      <!-- new stats section -->
      <section class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ projectStore.projects.length }}</span>
          <span class="stat-label">项目</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ taskStore.tasks.length }}</span>
          <span class="stat-label">总任务</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ taskStore.tasks.filter(t => t.status === 'completed').length }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ taskStore.tasks.filter(t => t.status === 'developing').length }}</span>
          <span class="stat-label">开发中</span>
        </div>
      </section>
    </main>
  </template>

  <style scoped>
  /* existing styles preserved */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }
  .stat-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow);
    text-align: center;
  }
  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 600;
    color: var(--color-accent);
    margin-bottom: var(--space-xs);
  }
  .stat-label {
    font-size: 0.875rem;
    color: var(--color-muted);
  }
  </style>
  ```
- **MIRROR**: 首页卡片布局 — 参见 `HomeView.vue:69-75`；store fetch 模式 — 参见 `TasksView.vue:11-14`
- **IMPORTS**: `useProjectStore`, `useTaskStore`, `onMounted`
- **GOTCHA**: 保持原有 sync-card 不变，在其下方追加；stats 用 grid 2 列适配侧边栏布局宽度
- **VALIDATE**: 首页显示 4 个统计数字且与任务/项目列表数据一致

### Task 15: 修改 useTaskStore — 补充 update 方法和统计
- **ACTION**: 更新 `src/renderer/src/stores/useTaskStore.ts`
- **IMPLEMENT**:
  ```ts
  import { defineStore } from 'pinia'
  import { ref, computed } from 'vue'
  import type { Task } from '../../../shared/types'
  import { TASK_STATUS, type TaskStatus } from '../../../shared/constants'

  export const useTaskStore = defineStore('task', () => {
    const tasks = ref<Task[]>([])
    const isLoading = ref(false)
    const currentProjectId = ref<string | null>(null)

    const filteredTasks = computed(() => {
      if (!currentProjectId.value) return tasks.value
      return tasks.value.filter((t) => t.projectId === currentProjectId.value)
    })

    const stats = computed(() => {
      const counts = {} as Record<TaskStatus, number>
      Object.values(TASK_STATUS).forEach((s) => { counts[s] = 0 })
      tasks.value.forEach((t) => { counts[t.status]++ })
      return counts
    })

    async function fetch(projectId?: string) {
      isLoading.value = true
      currentProjectId.value = projectId ?? null
      const result = await window.api.listTasks(projectId)
      if (result.ok) tasks.value = result.tasks
      isLoading.value = false
    }

    async function create(doc: Parameters<typeof window.api.createTask>[0]) {
      const result = await window.api.createTask(doc)
      if (result.ok) tasks.value = [...tasks.value, result.task]
      return result
    }

    async function update(id: string, changes: Partial<Task>) {
      const result = await window.api.updateTask(id, changes)
      if (result.ok) {
        tasks.value = tasks.value.map((t) => (t._id === id ? result.task : t))
      }
      return result
    }

    async function updateStatus(id: string, status: Task['status']) {
      return update(id, { status })
    }

    async function remove(id: string) {
      const result = await window.api.deleteTask(id)
      if (result.ok) {
        tasks.value = tasks.value.filter((t) => t._id !== id)
      }
      return result
    }

    return { tasks, isLoading, currentProjectId, filteredTasks, stats, fetch, create, update, updateStatus, remove }
  })
  ```
- **MIRROR**: Pinia setup store — 参见 `useTaskStore.ts:1-45`；不可变更新 — `tasks.value = [...]`
- **IMPORTS**: `TASK_STATUS`, `TaskStatus`
- **GOTCHA**: `updateStatus` 改为调用 `update`（DRY），保持 API 兼容；`stats` 初始化所有状态为 0
- **VALIDATE**: `update` 调用后列表正确更新；`stats` 返回所有 6 个状态的计数

### Task 16: 修改路由 — 添加详情页路由
- **ACTION**: 更新 `src/renderer/src/router/index.ts`
- **IMPLEMENT**:
  ```ts
  import { createRouter, createWebHashHistory } from 'vue-router'
  import { useAuthStore } from '../stores/useAuthStore'

  const LoginView = () => import('../views/LoginView.vue')
  const HomeView = () => import('../views/HomeView.vue')
  const ProjectsView = () => import('../views/ProjectsView.vue')
  const TasksView = () => import('../views/TasksView.vue')
  const TaskDetailView = () => import('../views/TaskDetailView.vue')
  const ProjectDetailView = () => import('../views/ProjectDetailView.vue')

  export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
      { path: '/', name: 'home', component: HomeView },
      { path: '/projects', name: 'projects', component: ProjectsView },
      { path: '/projects/:id', name: 'project-detail', component: ProjectDetailView },
      { path: '/tasks', name: 'tasks', component: TasksView },
      { path: '/tasks/:id', name: 'task-detail', component: TaskDetailView },
    ],
  })

  router.beforeEach((to) => {
    const auth = useAuthStore()
    if (!auth.currentUser && !to.meta.public) {
      return { name: 'login' }
    }
    if (auth.currentUser && to.name === 'login') {
      return { name: 'home' }
    }
  })
  ```
- **MIRROR**: Hash 路由 + 懒加载 — 参见 `router/index.ts:1-27`
- **IMPORTS**: `TaskDetailView`, `ProjectDetailView`
- **GOTCHA**: Electron 下必须用 `createWebHashHistory()`，不能用 `createWebHistory()`（file:// 协议限制）
- **VALIDATE**: `/tasks/abc123` 正确渲染 TaskDetailView；`/projects/abc123` 正确渲染 ProjectDetailView

### Task 17: 修改 main/ipc.ts — 注册目录选择 handler
- **ACTION**: 更新 `src/main/ipc.ts`
- **IMPLEMENT**: 在 `registerIpcHandlers` 末尾添加
  ```ts
  import { ipcMain, BrowserWindow, dialog } from 'electron'
  // ... existing imports ...

  export function registerIpcHandlers(win: BrowserWindow) {
    // ... existing handlers ...

    // --- Dialog handlers ---
    ipcMain.removeHandler('dialog:openDirectory')
    ipcMain.handle('dialog:openDirectory', async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
      })
      if (result.canceled) return { ok: false }
      return { ok: true, path: result.filePaths[0] }
    })
  }
  ```
- **MIRROR**: IPC handler 模式 — 参见 `ipc.ts:71-112`
- **IMPORTS**: `dialog` from `electron`
- **GOTCHA**: `removeHandler` 必须在 `handle` 之前；`showOpenDialog` 第一个参数是 `BrowserWindow`
- **VALIDATE**: 调用 `window.api.selectDirectory()` 弹出系统目录选择器

### Task 18: 修改 preload/index.ts — 暴露 selectDirectory
- **ACTION**: 更新 `src/preload/index.ts`
- **IMPLEMENT**: 在 `api` 对象中添加
  ```ts
  const api = {
    // ... existing APIs ...

    // === Dialog ===
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  }
  ```
- **MIRROR**: IPC preload 模式 — 参见 `preload/index.ts:28-34`
- **IMPORTS**: 无新增
- **GOTCHA**: `contextBridge.exposeInMainWorld('api', api)` 会自动包含新属性；TypeScript 类型通过 `typeof api` 自动推导
- **VALIDATE**: 在 renderer 进程控制台输入 `window.api.selectDirectory` 返回函数

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| getAllowedNext('planned') | 'planned' | ['pending'] | No |
| getAllowedNext('reviewing') | 'reviewing' | ['completed', 'pending', 'closed'] | Yes — 多分支 |
| getAllowedNext('completed') | 'completed' | [] | Yes — 终态 |
| STATUS_LABEL 覆盖 | all TASK_STATUS keys | all truthy | Yes |
| useTaskStore.stats | tasks with mixed statuses | all 6 counts correct | Yes |
| TaskForm edit mode | initialTask prop | fields pre-filled | No |
| TaskForm edit submit | unchanged fields | emit with empty changes | Yes |

### Edge Cases Checklist
- [ ] 空任务列表 — EmptyState 正确渲染
- [ ] 空项目列表 — EmptyState 正确渲染
- [ ] 过滤无结果 — EmptyState 正确渲染
- [ ] 终态任务（completed/closed）— 不显示流转按钮
- [ ] 编辑表单取消 — 不触发任何 store 操作
- [ ] 删除确认取消 — 不删除
- [ ] 路径选择器取消 — 不修改 path 值
- [ ] 同时显示创建和编辑表单 — 互斥，只显示一个

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck:node && npm run typecheck:web
```
EXPECT: Zero type errors

### Unit Tests
```bash
npx vitest run
```
EXPECT: All tests pass, including new taskTransitions tests

### Build Verification
```bash
npm run build
```
EXPECT: Build succeeds with no errors

### Manual Validation
- [ ] 登录后首页显示 4 个统计数字
- [ ] 任务页面：新建任务 → 出现在列表 → 点击"开始开发"→状态变为"开发中"
- [ ] 任务页面：选择项目过滤后只显示该项目任务
- [ ] 任务页面：选择状态过滤后只显示该状态任务
- [ ] 点击任务标题进入详情页，显示完整信息
- [ ] 详情页点击"编辑"→ 修改标题 → 保存 → 列表同步更新
- [ ] 详情页点击"删除"→ 确认 → 跳转回列表且任务消失
- [ ] reviewing 状态任务显示"完成""退回""关闭"三个按钮
- [ ] 项目页面：新建项目时用"选择文件夹"按钮选择路径
- [ ] 项目页面：点击项目名称进入详情页，显示关联任务列表
- [ ] 项目详情页编辑项目 → 保存 → 返回列表同步更新

---

## Acceptance Criteria
- [ ] 所有 18 个任务完成
- [ ] typecheck:node 和 typecheck:web 零错误
- [ ] vitest 全部通过
- [ ] npm run build 成功
- [ ] 能完整操作一个任务从 planned → pending → developing → reviewing → completed
- [ ] 项目路径支持系统文件选择器
- [ ] 任务和项目都有编辑、删除、详情页功能
- [ ] 首页显示统计看板
- [ ] 代码风格与现有 codebase 一致（Pinia setup stores, CSS tokens, IPC envelopes）

## Completion Checklist
- [ ] 代码遵循已发现的模式
- [ ] 错误处理匹配 codebase 风格（ok/error envelope）
- [ ] CSS 使用 design tokens
- [ ] 测试遵循 AAA 模式
- [ ] 无硬编码值
- [ ] 无 console.log
- [ ] 文档未变更（Phase 3 为纯 UI，无架构变更）
- [ ] 无超出范围的实现

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TaskForm 编辑模式与创建模式状态冲突 | Medium | Medium | 用 `mode` prop + computed 区分，编辑时不重置字段 |
| 文件选择器在打包后路径问题 | Low | Medium | 使用 `dialog.showOpenDialog` 返回绝对路径，跨平台兼容 |
| 内联状态流转按钮过多导致布局溢出 | Low | Low | flex-wrap + 小尺寸按钮 |
| HomeView stats 与 TasksView 数据不同步 | Low | Low | 都调用各自的 store.fetch()，数据来自同一个 PouchDB |

## Notes
- Phase 3 不涉及后端改动（已有 task:update 支持部分更新），仅添加 dialog:openDirectory IPC
- `reviewing` 状态支持退回 `pending`（退回重开发），这是 PRD 五状态机的明确要求
- 所有 CSS 使用 style.css 中已定义的 design tokens，不新增变量
- 中文界面，所有用户可见文本使用中文
- 计划完成后使用 `/prp-implement` 执行
