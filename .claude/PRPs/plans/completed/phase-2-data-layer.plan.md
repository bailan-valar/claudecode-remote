# Plan: Phase 2 — 数据层（CouchDB 认证 + DPU + Schema + CRUD）

## Summary

在 Phase 1 Electron + PouchDB 骨架基础上，引入 CouchDB 用户认证（`pouchdb-authentication`）、Database-Per-User 隔离模式、任务/项目文档 schema 定义，并通过 IPC 把 CRUD 操作暴露给渲染进程。Phase 2 完成后，用户能注册/登录、看到只属于「自己」的项目和任务列表，为 Phase 3 的桌面 UI 和 Phase 4 的任务引擎提供数据底座。

## User Story

As a Claude Code 多项目开发者，
I want 打开 App 后登录自己的账号、看到只属于我的项目列表和任务列表，
So that 多人共用同一台 CouchDB 时数据完全隔离，且我能在桌面端创建第一个项目和任务。

## Problem → Solution

**Current state**（Phase 1 结束后的假设状态）：Electron 窗口能启动，主进程 PouchDB 同步到一个共享 CouchDB 数据库，没有用户概念，没有文档 schema，渲染进程只能看 sync 状态。

**Desired state**：登录/注册 UI → 认证通过 → 自动切换到用户专属 DB（DPU）→ 本地 PouchDB 与远端用户 DB 双向同步 → 渲染进程可通过 IPC 对 project / task 做完整 CRUD → 首屏能看到项目列表和任务列表。

## Metadata

- **Complexity**: Medium（模块多但各自职责单一，无外部 API 集成）
- **Source PRD**: `.claude/PRPs/prds/claudecode-remote.prd.md`
- **PRD Phase**: Phase 2 — 数据层
- **Estimated Files**: ~21 个（15 新建 + 6 修改）
- **Time Estimate**: 1.5 ~ 2 天
- **Depends On**: Phase 1（Electron 骨架 + 主进程 PouchDB + IPC 桥）

---

## UX Design

### Before

```
┌────────────────────────────────────────────┐
│ ClaudeCode Remote                          │
├────────────────────────────────────────────┤
│                                            │
│   🟢 已连接 CouchDB                         │
│   couch.example.com                        │
│   同步状态：paused                          │
│                                            │
│   （没有用户，没有数据，到此为止）           │
│                                            │
└────────────────────────────────────────────┘
```

### After

```
┌────────────────────────────────────────────┐
│ ClaudeCode Remote — 已登录: alice           │
├────────────────────────────────────────────┤
│ [项目] [任务] [设置]                        │
├────────────────────────────────────────────┤
│                                            │
│ 我的项目                                   │
│ ┌─────────────────────────────────────┐   │
│ │ 📁 nuxt-target            /path/... │   │
│ │ 📁 claudecode-remote      /path/... │   │
│ └─────────────────────────────────────┘   │
│                                            │
│ 最近任务                                   │
│ ┌─────────────────────────────────────┐   │
│ │ ☐ 修复登录页样式          [计划中]  │   │
│ │ ☐ 添加任务删除确认          [待开发] │   │
│ │ ☑ 搭建 Electron 骨架        [待审核] │   │
│ └─────────────────────────────────────┘   │
│                                            │
│ 🟢 同步正常 — 3 个文档                     │
│                                            │
└────────────────────────────────────────────┘
```

### After — 未登录状态

```
┌────────────────────────────────────────────┐
│ ClaudeCode Remote                          │
├────────────────────────────────────────────┤
│                                            │
│   🔐 登录                                  │
│   ┌─────────────┐                          │
│   │ 用户名      │                          │
│   │ 密码        │                          │
│   │ [登录]      │                          │
│   └─────────────┘                          │
│   还没有账号？ [注册]                       │
│                                            │
└────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 启动应用 | 直接进入 sync 状态页 | 未登录 → 跳转登录页；已登录 → 恢复 session 进首页 | 自动恢复 session |
| 用户注册 | 无 | 输入用户名/密码 → 创建 CouchDB 用户 + DPU 库 | 需要 CouchDB 已启用 `couch_peruser` |
| 数据可见性 | 所有用户共享一个 DB | 完全隔离，各自只能看到自己的项目/任务 | DPU 机制 |
| 创建项目 | 无 | 表单填写名称 + 本地路径 → 写入用户 DB | Phase 3 再做完整表单校验 |
| 创建任务 | 无 | 表单填写标题 + 描述 + 选择项目 → 写入用户 DB | 任务默认状态 `planned` |
| 同步状态 | 显示 shared DB 状态 | 显示用户专属 DB 状态 | 切换用户后 sync 自动重连 |

---

## Mandatory Reading

### 本 Plan 依赖的 Phase 1 文件（必须先读）

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/main/db.ts`（Phase 1 产出） | all | SyncManager 类结构、EventEmitter 模式、PouchDB sync API；Phase 2 需在此基础上扩展用户切换 |
| P0 | `src/main/ipc.ts`（Phase 1 产出） | all | IPC handler 注册模式；Phase 2 需新增 auth + CRUD handler |
| P0 | `src/preload/index.ts`（Phase 1 产出） | all | contextBridge 暴露 API 的模式；Phase 2 需扩展新 method |
| P0 | `src/renderer/src/stores/useSyncStore.ts`（Phase 1 产出） | all | Pinia setup store + onScopeDispose 清理模式 |
| P1 | `electron.vite.config.ts`（Phase 1 产出） | all | 确保 `src/shared/` 能被 main 和 renderer 同时 import |
| P2 | `.claude/PRPs/plans/phase-1-scaffold-and-pouchdb.plan.md` | 370-388 | Phase 1 NOT Building 列表（Phase 2 正是承接这些边界） |

### PRD 相关段落

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 191-194 | Phase 2 原始 scope（"用户登录 + 多用户隔离的本地 + 远端数据同步"） |
| P0 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 82-101 | Core Capabilities 表格，理解 Must/Should/Could/Won't |
| P1 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 250-264 | Decisions Log（DPU、Electron 主进程、PouchDB 模式） |
| P1 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 147-157 | Technical Risks（CouchDB 部署、并发冲突等） |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| pouchdb-authentication API | https://github.com/pouchdb-community/pouchdb-authentication | `db.signUp()` / `db.logIn()` / `db.logOut()` / `db.getSession()`；基于 CouchDB `_users` DB 和 `_session` cookie |
| CouchDB couch_peruser | https://docs.couchdb.org/en/stable/config/couch-peruser.html | 配置 `[couch_peruser] enable = true`；每用户自动创建 `userdb-<hex>`；用户自动拥有 admin 权限 |
| PouchDB allDocs prefix query | https://pouchdb.com/guides/mango-queries.html | 本阶段不用 Mango（避免引入 pouchdb-find 插件）；用 `allDocs({ startkey: 'type:', endkey: 'type:￰' })` 做类型过滤 |
| CouchDB _users DB | https://docs.couchdb.org/en/stable/intro/security.html#users-db | 特殊系统库，存用户文档；pouchdb-authentication 自动处理 |
| PouchDB put/get/remove | https://pouchdb.com/api.html | `put(doc)` 需 `_id`；返回 `{ ok, id, rev }`；`get(id)` 取单条；`remove(doc)` 删除 |
| PouchDB sync events | https://pouchdb.com/api.html#sync | `change/active/paused/denied/error/complete`；`cancel()` 停止 |

```
KEY_INSIGHT: pouchdb-authentication 在 Node.js (Electron 主进程) 中使用 cookie session，
           但不同 PouchDB 实例间 cookie jar 不一定共享。
APPLIES_TO: Task 2（AuthManager）+ Task 4（SyncManager 重构）
GOTCHA: 对数据同步使用 basic auth（username/password 直接传 auth option）比依赖 cookie 更可靠；
        logIn/logOut 用 cookie，数据操作用 basic auth

KEY_INSIGHT: CouchDB couch_peruser 的 DB 命名规则是 userdb- + username 的 hex 编码（UTF-8 bytes）
APPLIES_TO: Task 4（getUserDbName 工具函数）
GOTCHA: 如果 CouchDB 没有启用 couch_peruser，用户注册后不会自动创建个人 DB；
        需要在 README 中说明这是「前提条件」，或提供手动创建 fallback

KEY_INSIGHT: PouchDB 的 allDocs 配合 startkey/endkey 是最高效的无插件类型查询方式
APPLIES_TO: Task 5（Repository 层）
GOTCHA: endkey 必须用 '￰'（最高 Unicode 字符）作为通配后缀；不能用 'type:z' 因为排序规则不同
```

---

## Patterns to Mirror

以下 pattern 全部来自 Phase 1 已确立的代码风格，Phase 2 必须严格遵循。

### NAMING_CONVENTION
// SOURCE: Phase 1 plan — NAMING_CONVENTION section
```
src/
├── main/
│   ├── auth.ts             # camelCase 文件名
│   ├── db.ts               # Phase 1 已存在，修改而非重写
│   ├── ipc.ts              # Phase 1 已存在，追加 handler
│   └── repositories/
│       ├── baseRepository.ts
│       ├── projectRepository.ts
│       └── taskRepository.ts
├── preload/
│   └── index.ts            # Phase 1 已存在，扩展 api 对象
├── shared/
│   ├── types.ts            # PascalCase interface
│   └── constants.ts        # UPPER_SNAKE_CASE 常量
└── renderer/src/
    ├── stores/
    │   ├── useAuthStore.ts
    │   ├── useProjectStore.ts
    │   └── useTaskStore.ts
    ├── views/
    │   ├── LoginView.vue     # PascalCase 组件
    │   └── HomeView.vue      # Phase 1 已存在，扩展内容
    └── types/
        └── api.d.ts          # Phase 1 已存在，扩展类型
```

### IPC_BRIDGE_PATTERN
// SOURCE: Phase 1 plan — IPC_BRIDGE_PATTERN section（`src/preload/index.ts`）
```ts
const api = {
  // Phase 1 已有
  onSyncStatus: (cb) => { ... },
  refreshSync: () => ipcRenderer.invoke('sync:refresh'),

  // Phase 2 新增
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  register: (username: string, password: string) =>
    ipcRenderer.invoke('auth:register', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:session'),

  listProjects: () => ipcRenderer.invoke('project:list'),
  createProject: (doc: Omit<Project, '_id' | '_rev'>) =>
    ipcRenderer.invoke('project:create', doc),
  updateProject: (id: string, doc: Partial<Project>) =>
    ipcRenderer.invoke('project:update', id, doc),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  listTasks: (projectId?: string) => ipcRenderer.invoke('task:list', projectId),
  createTask: (doc: Omit<Task, '_id' | '_rev'>) =>
    ipcRenderer.invoke('task:create', doc),
  updateTask: (id: string, doc: Partial<Task>) =>
    ipcRenderer.invoke('task:update', id, doc),
  deleteTask: (id: string) => ipcRenderer.invoke('task:delete', id),
}
```
**注意**：只暴露白名单 API，绝不暴露 `ipcRenderer` 全集。

### MAIN_IPC_HANDLER_PATTERN
// SOURCE: Phase 1 plan — MAIN_IPC_HANDLER_PATTERN section（`src/main/ipc.ts`）
```ts
export function registerIpcHandlers(win: BrowserWindow) {
  // Phase 1 已有
  ipcMain.handle('sync:refresh', async () => { ... });

  // Phase 2 新增 —— auth handlers
  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try {
      const user = await authManager.login(username, password);
      await syncManager.switchToUser(username, password);
      return { ok: true, user };
    } catch (err: any) {
      return { ok: false, error: err.message || '登录失败' };
    }
  });

  // ... 其它 handler
}
```
**注意**：Electron IPC 第一个参数是 `event`，用 `_` 占位；从第二个参数开始是渲染进程传过来的实参。

### PINIA_STORE_PATTERN
// SOURCE: Phase 1 plan — PINIA_STORE_PATTERN section
```ts
export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<{ username: string } | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function login(username: string, password: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await window.api.login(username, password);
      if (result.ok) currentUser.value = result.user;
      else error.value = result.error;
    } finally {
      isLoading.value = false;
    }
  }

  async function checkSession() {
    const result = await window.api.getSession();
    if (result.user) currentUser.value = result.user;
  }

  return { currentUser, isLoading, error, login, checkSession };
});
```

### VUE_COMPONENT_PATTERN
// SOURCE: Phase 1 plan — VUE_COMPONENT_PATTERN section
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/useAuthStore';

const auth = useAuthStore();
const username = ref('');
const password = ref('');

async function handleLogin() {
  await auth.login(username.value, password.value);
}
</script>

<template>
  <form @submit.prevent="handleLogin">
    <input v-model="username" placeholder="用户名" required />
    <input v-model="password" type="password" placeholder="密码" required />
    <button type="submit" :disabled="auth.isLoading">
      {{ auth.isLoading ? '登录中...' : '登录' }}
    </button>
    <p v-if="auth.error" class="error">{{ auth.error }}</p>
  </form>
</template>
```

### ERROR_HANDLING_PATTERN
// SOURCE: Phase 1 plan — ERROR_HANDLING section + ECC common/coding-style.md
```ts
// 主进程：错误必须显式处理，不静默吞掉
// 返回 { ok: false, error: string } 给渲染进程，而不是抛未捕获异常
ipcMain.handle('auth:login', async (_, username, password) => {
  try {
    // ... do work
    return { ok: true, user };
  } catch (err: any) {
    console.error('[auth] login failed:', err.message);
    return { ok: false, error: err.message || '登录失败' };
  }
});

// 渲染进程：UI 显示 user-friendly 文案
const errorText = computed(() => auth.error);
```

### TYPE_DEFINITIONS_PATTERN
// SOURCE: Phase 1 plan — TYPE_DEFINITIONS_PATTERN section
```ts
// src/renderer/src/types/api.d.ts
import type { Api } from '../../../preload/index';

declare global {
  interface Window {
    api: Api;
  }
}

export {}
```
Phase 2 需扩展 Api 类型以包含新增的 login/register/listProjects 等方法。

---

## Files to Change

### 新建文件（15 个）

| File | Action | Justification |
|---|---|---|
| `src/shared/types.ts` | CREATE | 主进程和渲染进程共享的 TypeScript 类型（Project, Task, User 等） |
| `src/shared/constants.ts` | CREATE | 共享常量（文档 type 前缀、任务状态枚举、优先级枚举） |
| `src/main/auth.ts` | CREATE | AuthManager 类：封装 pouchdb-authentication 的 signUp/logIn/logOut/getSession |
| `src/main/repositories/baseRepository.ts` | CREATE | 通用 Repository 基类：allDocs 前缀查询 + put/get/remove 封装 |
| `src/main/repositories/projectRepository.ts` | CREATE | Project 文档的 CRUD，继承 BaseRepository |
| `src/main/repositories/taskRepository.ts` | CREATE | Task 文档的 CRUD，继承 BaseRepository |
| `src/renderer/src/stores/useAuthStore.ts` | CREATE | Auth 状态管理（currentUser, login, logout, checkSession） |
| `src/renderer/src/stores/useProjectStore.ts` | CREATE | Project 列表状态（projects, fetch, create, update, delete） |
| `src/renderer/src/stores/useTaskStore.ts` | CREATE | Task 列表状态（tasks, fetchByProject, create, updateStatus, delete） |
| `src/renderer/src/views/LoginView.vue` | CREATE | 登录/注册切换表单 |
| `src/renderer/src/views/ProjectsView.vue` | CREATE | 项目列表页（创建按钮 + 列表） |
| `src/renderer/src/views/TasksView.vue` | CREATE | 任务列表页（按项目过滤 + 创建按钮 + 列表） |
| `src/renderer/src/components/ProjectForm.vue` | CREATE | 项目创建/编辑表单（名称 + 路径 + 描述） |
| `src/renderer/src/components/TaskForm.vue` | CREATE | 任务创建表单（标题 + 描述 + prompt + 选择项目） |
| `src/main/repositories/__tests__/baseRepository.test.ts` | CREATE | BaseRepository 单元测试（memory adapter） |

### 修改文件（6 个）

| File | Action | Justification |
|---|---|---|
| `package.json` | UPDATE | 新增 `pouchdb-authentication` 依赖 |
| `src/main/db.ts` | UPDATE | SyncManager 新增 `switchToUser()`、`logout()`、`getLocalDb()`；支持动态切换用户 DB |
| `src/main/ipc.ts` | UPDATE | 注册 auth + project + task 的 IPC handler |
| `src/preload/index.ts` | UPDATE | contextBridge 扩展 auth + project + task API |
| `src/renderer/src/router/index.ts` | UPDATE | 新增 login / projects / tasks 路由；登录态守卫 |
| `src/renderer/src/App.vue` | UPDATE | 登录态感知布局（已登录显示侧边栏 + 主内容，未登录只显示 RouterView） |

### NOT Building

> 严格守住 Phase 2 边界，以下项**不在**本阶段。

- ❌ 用户资料编辑（修改密码、头像等）— v1 只支持注册/登录/注销
- ❌ 忘记密码流程 — CouchDB 原生不支持，v1 不做
- ❌ 任务引擎、claude -p 子进程、p-queue — Phase 4
- ❌ 任务状态自动流转（计划中→待开发→开发中→待审核→已完成）— 手动按钮在 Phase 3，自动流转在 Phase 4
- ❌ 子任务、parentTaskId 关联展示 — Phase 8
- ❌ 进度日志、stream-json 解析 — Phase 9
- ❌ 多 LLM 配置存储（project.llmConfig 字段先预留，UI 不做）— Phase 5
- ❌ 移动端 PWA — Phase 6
- ❌ 项目级工具白名单配置 — Phase 5
- ❌ 任务失败重试策略 — Phase 4+
- ❌ 完整表单校验（Zod 等）— Phase 3 统一做
- ❌ 生产环境 OS keychain 存储密码 — Phase 2 只保留内存 session
- ❌ 覆盖率 80% — Phase 2 只要求核心 repository + auth 有测试，覆盖率到 Phase 4 补

---

## Step-by-Step Tasks

### Task 1: 安装 pouchdb-authentication

- **ACTION**: 在 Phase 1 已有的 `package.json` 基础上新增依赖
- **IMPLEMENT**:
  ```bash
  npm install pouchdb-authentication
  npm install -D @types/pouchdb
  ```
- **MIRROR**: Phase 1 Task 2（依赖安装模式）
- **IMPORTS**: N/A（npm install）
- **GOTCHA**:
  - `pouchdb-authentication` 最新版支持 PouchDB v9；如遇类型报错先 `npm ls pouchdb` 确认版本一致
  - `@types/pouchdb` 已含 pouchdb-authentication 的类型声明（`PouchDB.Authentication` 命名空间）
- **VALIDATE**:
  ```bash
  npm ls pouchdb-authentication
  # 应显示版本号，无 UNMET
  ```

### Task 2: 创建共享类型和常量

- **ACTION**: 新建 `src/shared/types.ts` 和 `src/shared/constants.ts`
- **IMPLEMENT**:
  ```ts
  // src/shared/constants.ts
  export const DOC_TYPE = {
    PROJECT: 'project' as const,
    TASK: 'task' as const,
  };

  export const TASK_STATUS = {
    PLANNED: 'planned',
    PENDING: 'pending',
    DEVELOPING: 'developing',
    REVIEWING: 'reviewing',
    COMPLETED: 'completed',
    CLOSED: 'closed',
  } as const;

  export const TASK_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  } as const;

  export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
  export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];
  ```
  ```ts
  // src/shared/types.ts
  export interface BaseDoc {
    _id: string;
    _rev: string;
    type: string;
  }

  export interface Project extends BaseDoc {
    type: 'project';
    name: string;
    path: string;
    description?: string;
    llmConfig?: {
      provider: 'anthropic' | 'zhipu' | 'kimi';
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    };
    allowedTools?: string[];
    createdAt: string;
    updatedAt: string;
  }

  export interface Task extends BaseDoc {
    type: 'task';
    projectId: string;
    parentTaskId?: string | null;
    title: string;
    description?: string;
    prompt: string;
    status: import('./constants').TaskStatus;
    priority: import('./constants').TaskPriority;
    claudeSessionId?: string | null;
    logs: Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      message: string;
    }>;
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
    createdVia: 'desktop' | 'mobile';
    reviewFeedback?: string;
  }

  export interface User {
    username: string;
    roles: string[];
  }
  ```
- **MIRROR**: ECC common/coding-style.md（不可变模式：interface 定义，创建新对象）
- **IMPORTS**: 无外部依赖（纯类型定义）
- **GOTCHA**:
  - `src/shared/` 目录需确保被 electron-vite 的 tsconfig 包含（main 和 renderer 的 tsconfig 都要 include）
  - Task 的 `status` / `priority` 用 `import('./constants')` 做类型引用，保持单一真相源
  - `_id` 必须包含 `type:` 前缀，如 `project:<uuid>`、`task:<uuid>`，这是 `allDocs` 前缀查询的前提
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  npx vue-tsc --noEmit
  # 两个命令都应 0 错误
  ```

### Task 3: 创建 AuthManager

- **ACTION**: 新建 `src/main/auth.ts`
- **IMPLEMENT**:
  ```ts
  import PouchDB from 'pouchdb';
  import PouchAuth from 'pouchdb-authentication';

  PouchDB.plugin(PouchAuth);

  export interface User {
    username: string;
    roles: string[];
  }

  export class AuthManager {
    private db: PouchDB.Database;

    constructor(baseUrl: string) {
      // 指向 CouchDB 根 URL，不是具体 DB
      this.db = new PouchDB(baseUrl);
    }

    async signUp(username: string, password: string): Promise<void> {
      await (this.db as any).signUp(username, password);
    }

    async logIn(username: string, password: string): Promise<User> {
      const response = await (this.db as any).logIn(username, password);
      return { username: response.name, roles: response.roles };
    }

    async logOut(): Promise<void> {
      await (this.db as any).logOut();
    }

    async getSession(): Promise<User | null> {
      const response = await (this.db as any).getSession();
      if (response.userCtx?.name) {
        return { username: response.userCtx.name, roles: response.userCtx.roles };
      }
      return null;
    }
  }
  ```
- **MIRROR**: Phase 1 POUCHDB_SYNC_PATTERN（PouchDB 实例化模式）
- **IMPORTS**:
  ```ts
  import PouchDB from 'pouchdb';
  import PouchAuth from 'pouchdb-authentication';
  PouchDB.plugin(PouchAuth);
  ```
- **GOTCHA**:
  - `pouchdb-authentication` 给 PouchDB.Database 原型添加方法，TypeScript 需要 `as any` 或扩展声明文件
  - 更优雅的做法是在 `src/shared/pouchdb-auth.d.ts` 扩展类型：
    ```ts
    declare module 'pouchdb' {
      interface Database {
        signUp(username: string, password: string): Promise<any>;
        logIn(username: string, password: string): Promise<any>;
        logOut(): Promise<any>;
        getSession(): Promise<any>;
      }
    }
    ```
  - `baseUrl` 必须指向 CouchDB 服务器根（如 `http://localhost:5984`），不含库名；因为 auth 操作调用的是 `/_users` 和 `/_session` 端点
  - 注册失败常见原因：CouchDB admin 未配置、`_users` DB 不存在、用户已存在；错误 message 要透传给 UI
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 4: 重构 SyncManager 支持用户切换

- **ACTION**: 修改 `src/main/db.ts`（Phase 1 产出）
- **IMPLEMENT**:
  ```ts
  import PouchDB from 'pouchdb';
  import { EventEmitter } from 'node:events';

  export type SyncStatus =
    | { phase: 'idle' }
    | { phase: 'connecting' }
    | { phase: 'active'; lastChange?: number }
    | { phase: 'paused' }
    | { phase: 'error'; message: string };

  export interface SyncManagerOptions {
    baseUrl: string;
    adminAuth?: { username: string; password: string };
  }

  export function getUserDbName(username: string): string {
    return 'userdb-' + Buffer.from(username).toString('hex');
  }

  export class SyncManager extends EventEmitter {
    private baseUrl: string;
    private adminAuth?: { username: string; password: string };
    private local?: PouchDB.Database;
    private remote?: PouchDB.Database;
    private handle?: PouchDB.Replication.Sync<{}>;
    private currentUsername?: string;

    constructor(options: SyncManagerOptions) {
      super();
      this.baseUrl = options.baseUrl;
      this.adminAuth = options.adminAuth;
    }

    get currentUser(): string | undefined {
      return this.currentUsername;
    }

    getLocalDb(): PouchDB.Database | undefined {
      return this.local;
    }

    async switchToUser(username: string, password: string): Promise<void> {
      this.stop();

      const localName = `cc-remote-${username}`;
      const remoteName = getUserDbName(username);

      this.local = new PouchDB(localName);
      this.remote = new PouchDB(`${this.baseUrl}/${remoteName}`, {
        auth: { username, password },
      });
      this.currentUsername = username;

      // 确保远端 DB 存在（couch_peruser 会自动创建，但以防万一）
      try {
        await this.remote.info();
      } catch (err: any) {
        if (err.status === 404 && this.adminAuth) {
          // 用 admin 凭据创建 DB
          const adminRemote = new PouchDB(`${this.baseUrl}/${remoteName}`, {
            auth: this.adminAuth,
          });
          await adminRemote.info(); // PUT 创建
        }
      }

      this.start();
    }

    logout(): void {
      this.stop();
      this.local = undefined;
      this.remote = undefined;
      this.currentUsername = undefined;
      this.emit('status', { phase: 'idle' });
    }

    private start(): void {
      if (!this.local || !this.remote) return;
      this.emit('status', { phase: 'connecting' });
      this.handle = this.local
        .sync(this.remote, { live: true, retry: true })
        .on('change', (info) => {
          const changeCount = (info.change?.docs?.length) ?? 0;
          this.emit('status', { phase: 'active', lastChange: changeCount });
        })
        .on('paused', () => this.emit('status', { phase: 'paused' }))
        .on('active', () => this.emit('status', { phase: 'active' }))
        .on('denied', (err) =>
          this.emit('status', { phase: 'error', message: `denied: ${err.reason}` }),
        )
        .on('error', (err) =>
          this.emit('status', { phase: 'error', message: String(err.message || err) }),
        );
    }

    private stop(): void {
      this.handle?.cancel?.();
      this.handle = undefined;
    }

    restart(): void {
      this.stop();
      this.start();
    }
  }
  ```
- **MIRROR**: Phase 1 POUCHDB_SYNC_PATTERN（EventEmitter + sync 事件模式）
- **IMPORTS**: 见代码片段
- **GOTCHA**:
  - Phase 1 的 SyncManager 是单例模式（`export const syncManager = new SyncManager(...)`）；Phase 2 需要把单例的构造参数改为 `options` 对象，并在 `index.ts` 中更新实例化代码
  - `switchToUser` 必须 `stop()` 旧 sync 再启动新 sync，否则会出现多个 sync 句柄泄漏
  - 本地 DB 名用 `cc-remote-${username}` 而非共享的 `cc-remote-local`，避免多用户数据混在一个 LevelDB 目录
  - 对 `remote.info()` 的 404 fallback 是「保险」逻辑；如果 CouchDB 已启用 `couch_peruser`，signUp 后 DB 已经存在，不会进 fallback
  - `adminAuth` 从环境变量读取（`COUCHDB_ADMIN_USER` / `COUCHDB_ADMIN_PASSWORD`），用于无 `couch_peruser` 时手动创建 DB
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 5: 创建 Repository 层

- **ACTION**: 新建 `src/main/repositories/baseRepository.ts`、`projectRepository.ts`、`taskRepository.ts`
- **IMPLEMENT**:
  ```ts
  // src/main/repositories/baseRepository.ts
  import type { BaseDoc } from '../../shared/types';

  export class BaseRepository<T extends BaseDoc> {
    constructor(
      private db: PouchDB.Database,
      private type: string,
    ) {}

    async findAll(): Promise<T[]> {
      const result = await this.db.allDocs({
        startkey: `${this.type}:`,
        endkey: `${this.type}:￰`,
        include_docs: true,
      });
      return result.rows.map((r) => r.doc as T);
    }

    async findById(id: string): Promise<T | null> {
      try {
        return (await this.db.get(id)) as T;
      } catch (err: any) {
        if (err.status === 404) return null;
        throw err;
      }
    }

    async create(doc: Omit<T, '_id' | '_rev'>): Promise<T> {
      const id = `${this.type}:${crypto.randomUUID()}`;
      const toInsert = { ...doc, _id: id } as unknown as T;
      const result = await this.db.put(toInsert);
      return { ...toInsert, _rev: result.rev } as T;
    }

    async update(id: string, changes: Partial<Omit<T, '_id' | '_rev'>>): Promise<T> {
      const existing = await this.db.get(id);
      const updated = { ...existing, ...changes, _id: id, _rev: existing._rev };
      const result = await this.db.put(updated);
      return { ...updated, _rev: result.rev } as T;
    }

    async delete(id: string): Promise<void> {
      const doc = await this.db.get(id);
      await this.db.remove(doc);
    }
  }
  ```
  ```ts
  // src/main/repositories/projectRepository.ts
  import { BaseRepository } from './baseRepository';
  import type { Project } from '../../shared/types';

  export function createProjectRepository(db: PouchDB.Database) {
    return new BaseRepository<Project>(db, 'project');
  }
  ```
  ```ts
  // src/main/repositories/taskRepository.ts
  import { BaseRepository } from './baseRepository';
  import type { Task } from '../../shared/types';

  export function createTaskRepository(db: PouchDB.Database) {
    return new BaseRepository<Task>(db, 'task');
  }
  ```
- **MIRROR**: ECC common/patterns.md（Repository Pattern）+ Phase 1 不可变数据风格
- **IMPORTS**:
  ```ts
  import type { BaseDoc, Project, Task } from '../../shared/types';
  ```
- **GOTCHA**:
  - `crypto.randomUUID()` 需要 Node.js v14.17+；Electron 内置 Node 版本足够新，但如果报错可换 `Date.now().toString(36) + Math.random().toString(36).slice(2)`
  - `allDocs` 的 `￰` 是「最高 Unicode 码点」通配技巧；不要用 `z` 或 `~` 替代，排序行为不同
  - `BaseRepository.create` 接收 `Omit<T, '_id' | '_rev'>` 确保调用方不传入 `_id` / `_rev`；但 TypeScript spread 后可能丢失精确类型，所以用 `as unknown as T` 做类型断言
  - Repository 不持有单例 DB，而是接收 DB 参数；因为用户切换后 DB 实例会变
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 6: 注册 IPC Handler（auth + project + task）

- **ACTION**: 修改 `src/main/ipc.ts`
- **IMPLEMENT**:
  ```ts
  import { ipcMain, BrowserWindow } from 'electron';
  import { syncManager } from './db';
  import { authManager } from './auth';
  import { createProjectRepository } from './repositories/projectRepository';
  import { createTaskRepository } from './repositories/taskRepository';

  export function registerIpcHandlers(win: BrowserWindow) {
    // --- Phase 1 已有 handler（保持不变）---
    ipcMain.removeHandler('sync:refresh');
    ipcMain.handle('sync:refresh', async () => {
      syncManager.restart();
      return { ok: true };
    });

    syncManager.on('status', (status) => {
      if (!win.isDestroyed()) {
        win.webContents.send('sync:status', status);
      }
    });

    // --- Auth handlers ---
    ipcMain.removeHandler('auth:register');
    ipcMain.handle('auth:register', async (_, username: string, password: string) => {
      try {
        await authManager.signUp(username, password);
        return { ok: true };
      } catch (err: any) {
        console.error('[auth] register failed:', err.message);
        return { ok: false, error: err.message || '注册失败' };
      }
    });

    ipcMain.removeHandler('auth:login');
    ipcMain.handle('auth:login', async (_, username: string, password: string) => {
      try {
        const user = await authManager.logIn(username, password);
        await syncManager.switchToUser(username, password);
        return { ok: true, user };
      } catch (err: any) {
        console.error('[auth] login failed:', err.message);
        return { ok: false, error: err.message || '登录失败' };
      }
    });

    ipcMain.removeHandler('auth:logout');
    ipcMain.handle('auth:logout', async () => {
      try {
        await authManager.logOut();
        syncManager.logout();
        return { ok: true };
      } catch (err: any) {
        console.error('[auth] logout failed:', err.message);
        return { ok: false, error: err.message || '注销失败' };
      }
    });

    ipcMain.removeHandler('auth:session');
    ipcMain.handle('auth:session', async () => {
      try {
        const user = await authManager.getSession();
        return { user };
      } catch (err: any) {
        console.error('[auth] getSession failed:', err.message);
        return { user: null };
      }
    });

    // --- Project CRUD handlers ---
    ipcMain.removeHandler('project:list');
    ipcMain.handle('project:list', async () => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createProjectRepository(db);
      const projects = await repo.findAll();
      return { ok: true, projects };
    });

    ipcMain.removeHandler('project:create');
    ipcMain.handle('project:create', async (_, doc) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createProjectRepository(db);
      const now = new Date().toISOString();
      const project = await repo.create({
        ...doc,
        type: 'project',
        createdAt: now,
        updatedAt: now,
      });
      return { ok: true, project };
    });

    ipcMain.removeHandler('project:update');
    ipcMain.handle('project:update', async (_, id: string, changes) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createProjectRepository(db);
      const project = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() });
      return { ok: true, project };
    });

    ipcMain.removeHandler('project:delete');
    ipcMain.handle('project:delete', async (_, id: string) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createProjectRepository(db);
      await repo.delete(id);
      return { ok: true };
    });

    // --- Task CRUD handlers ---
    ipcMain.removeHandler('task:list');
    ipcMain.handle('task:list', async (_, projectId?: string) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createTaskRepository(db);
      let tasks = await repo.findAll();
      if (projectId) {
        tasks = tasks.filter((t) => t.projectId === projectId);
      }
      return { ok: true, tasks };
    });

    ipcMain.removeHandler('task:create');
    ipcMain.handle('task:create', async (_, doc) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createTaskRepository(db);
      const now = new Date().toISOString();
      const task = await repo.create({
        ...doc,
        type: 'task',
        status: doc.status || 'planned',
        priority: doc.priority || 'medium',
        logs: [],
        createdAt: now,
        updatedAt: now,
        createdVia: 'desktop',
      });
      return { ok: true, task };
    });

    ipcMain.removeHandler('task:update');
    ipcMain.handle('task:update', async (_, id: string, changes) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createTaskRepository(db);
      const task = await repo.update(id, { ...changes, updatedAt: new Date().toISOString() });
      return { ok: true, task };
    });

    ipcMain.removeHandler('task:delete');
    ipcMain.handle('task:delete', async (_, id: string) => {
      const db = syncManager.getLocalDb();
      if (!db) return { ok: false, error: '未登录' };
      const repo = createTaskRepository(db);
      await repo.delete(id);
      return { ok: true };
    });
  }
  ```
- **MIRROR**: Phase 1 MAIN_IPC_HANDLER_PATTERN（`ipcMain.handle` + `removeHandler` + `win.webContents.send`）
- **IMPORTS**:
  ```ts
  import { ipcMain, BrowserWindow } from 'electron';
  import { syncManager } from './db';
  import { authManager } from './auth';
  import { createProjectRepository } from './repositories/projectRepository';
  import { createTaskRepository } from './repositories/taskRepository';
  ```
- **GOTCHA**:
  - **必须**在每个 handler 注册前调用 `ipcMain.removeHandler(channel)`，否则 Electron HMR 时会报「handler already registered」
  - 所有 handler 的**第一个参数是 `event`**，用 `_` 占位；从第二个参数起才是渲染进程传来的数据
  - CRUD handler 统一检查 `syncManager.getLocalDb()` —— 未登录时返回 `{ ok: false, error: '未登录' }`，不要让 PouchDB 报错崩掉
  - `project:create` 和 `task:create` 在服务端补全 `type`、`createdAt`、`updatedAt`、`logs`、`createdVia` 等字段，而不是信任渲染进程传入的值
  - `syncManager.on('status', ...)` 只需注册一次；如果 Phase 1 已经注册，不要重复注册（检查 Phase 1 的 `ipc.ts` 内容）
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 7: 更新主进程入口（index.ts）

- **ACTION**: 修改 `src/main/index.ts`
- **IMPLEMENT**:
  在 Phase 1 的 `index.ts` 基础上，把 `syncManager` 的实例化改为新的 options 格式，并新增 `authManager` 实例化：
  ```ts
  import { SyncManager } from './db';
  import { AuthManager } from './auth';

  export const syncManager = new SyncManager({
    baseUrl: process.env.COUCHDB_URL?.replace(/\/[^/]*$/, '') || 'http://localhost:5984',
    adminAuth: process.env.COUCHDB_ADMIN_USER && process.env.COUCHDB_ADMIN_PASSWORD
      ? { username: process.env.COUCHDB_ADMIN_USER, password: process.env.COUCHDB_ADMIN_PASSWORD }
      : undefined,
  });

  export const authManager = new AuthManager(
    process.env.COUCHDB_URL?.replace(/\/[^/]*$/, '') || 'http://localhost:5984',
  );
  ```
  注意：`COUCHDB_URL` 可能是 `http://localhost:5984/cc-remote`（带库名），需要 `replace` 去掉末尾库名得到 base URL。
- **MIRROR**: Phase 1 入口文件模式
- **IMPORTS**: 见上
- **GOTCHA**:
  - `syncManager` 和 `authManager` 是单例，导出供 `ipc.ts` import
  - 如果 `COUCHDB_URL` 不含协议（如 `localhost:5984`），需要补 `http://`
  - `COUCHDB_ADMIN_USER` / `COUCHDB_ADMIN_PASSWORD` 是新增环境变量，需加到 `.env.example`
  - Phase 1 的 `syncManager.start()` 在 `app.whenReady()` 中调用；Phase 2 不再自动 `start()`，改为登录成功后才 `switchToUser().start()`；但如果没有自动登录，sync 应保持 `idle` 状态
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 8: 更新 Preload API

- **ACTION**: 修改 `src/preload/index.ts`
- **IMPLEMENT**:
  在 Phase 1 的 `api` 对象基础上扩展：
  ```ts
  import { contextBridge, ipcRenderer } from 'electron';
  import type { Project, Task } from '../shared/types';

  const api = {
    // === Phase 1 已有 ===
    onSyncStatus: (cb: (status: any) => void) => {
      const listener = (_: unknown, status: any) => cb(status);
      ipcRenderer.on('sync:status', listener);
      return () => ipcRenderer.off('sync:status', listener);
    },
    refreshSync: () => ipcRenderer.invoke('sync:refresh'),

    // === Auth ===
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    register: (username: string, password: string) =>
      ipcRenderer.invoke('auth:register', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:session'),

    // === Projects ===
    listProjects: () => ipcRenderer.invoke('project:list'),
    createProject: (doc: Omit<Project, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt'>) =>
      ipcRenderer.invoke('project:create', doc),
    updateProject: (id: string, doc: Partial<Project>) =>
      ipcRenderer.invoke('project:update', id, doc),
    deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

    // === Tasks ===
    listTasks: (projectId?: string) => ipcRenderer.invoke('task:list', projectId),
    createTask: (doc: Omit<Task, '_id' | '_rev' | 'type' | 'createdAt' | 'updatedAt' | 'logs' | 'createdVia'>) =>
      ipcRenderer.invoke('task:create', doc),
    updateTask: (id: string, doc: Partial<Task>) =>
      ipcRenderer.invoke('task:update', id, doc),
    deleteTask: (id: string) => ipcRenderer.invoke('task:delete', id),
  };

  contextBridge.exposeInMainWorld('api', api);
  export type Api = typeof api;
  ```
- **MIRROR**: Phase 1 IPC_BRIDGE_PATTERN
- **IMPORTS**:
  ```ts
  import { contextBridge, ipcRenderer } from 'electron';
  import type { Project, Task } from '../shared/types';
  ```
- **GOTCHA**:
  - `preload` 运行在主进程和渲染进程之间，可以 import 共享类型（`../shared/types`），但不能 import Node-only 模块
  - `Omit<Project, ...>` 的类型要精确：渲染进程传给 `createProject` 的 doc 不应包含服务端自动填充的字段
  - 所有 IPC invoke 调用**必须**与 `ipc.ts` 中注册的 channel 名完全一致，一字不差
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 9: 更新渲染进程类型声明

- **ACTION**: 修改 `src/renderer/src/types/api.d.ts`
- **IMPLEMENT**:
  ```ts
  import type { Api } from '../../../preload/index';

  declare global {
    interface Window {
      api: Api;
    }
  }

  export {}
  ```
  这个文件在 Phase 1 已存在，Phase 2 只需确认 `Api` 类型（由 `preload/index.ts` 的 `typeof api` 导出）已自动包含新增方法。如果 `Api` 类型没有自动更新，检查 `preload/index.ts` 是否正确 `export type Api = typeof api`。
- **MIRROR**: Phase 1 TYPE_DEFINITIONS_PATTERN
- **IMPORTS**: 无（只需确认）
- **GOTCHA**:
  - 如果 `preload/index.ts` 改了但 `api.d.ts` 里没补全，VSCode 可能不报错但运行时报 `window.api.xxx is not a function`
  - `Api` 类型通过 `typeof api` 自动推导，只要 preload 的 `api` 对象定义正确，这里不需要手动维护
- **VALIDATE**:
  ```bash
  npx vue-tsc --noEmit
  # 在 LoginView.vue 中输入 window.api.login 应有自动补全
  ```

### Task 10: 创建 Pinia Store（auth + project + task）

- **ACTION**: 新建 3 个 store 文件
- **IMPLEMENT**:
  ```ts
  // src/renderer/src/stores/useAuthStore.ts
  import { defineStore } from 'pinia';
  import { ref } from 'vue';

  interface User {
    username: string;
    roles: string[];
  }

  export const useAuthStore = defineStore('auth', () => {
    const currentUser = ref<User | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    async function login(username: string, password: string) {
      isLoading.value = true;
      error.value = null;
      try {
        const result = await window.api.login(username, password);
        if (result.ok) currentUser.value = result.user;
        else error.value = result.error;
      } finally {
        isLoading.value = false;
      }
    }

    async function register(username: string, password: string) {
      isLoading.value = true;
      error.value = null;
      try {
        const result = await window.api.register(username, password);
        if (result.ok) {
          // 注册成功后自动登录
          await login(username, password);
        } else {
          error.value = result.error;
        }
      } finally {
        isLoading.value = false;
      }
    }

    async function logout() {
      await window.api.logout();
      currentUser.value = null;
    }

    async function checkSession() {
      const result = await window.api.getSession();
      if (result.user) currentUser.value = result.user;
    }

    return { currentUser, isLoading, error, login, register, logout, checkSession };
  });
  ```
  ```ts
  // src/renderer/src/stores/useProjectStore.ts
  import { defineStore } from 'pinia';
  import { ref } from 'vue';
  import type { Project } from '../../../shared/types';

  export const useProjectStore = defineStore('project', () => {
    const projects = ref<Project[]>([]);
    const isLoading = ref(false);

    async function fetch() {
      isLoading.value = true;
      const result = await window.api.listProjects();
      if (result.ok) projects.value = result.projects;
      isLoading.value = false;
    }

    async function create(doc: Parameters<typeof window.api.createProject>[0]) {
      const result = await window.api.createProject(doc);
      if (result.ok) projects.value.push(result.project);
      return result;
    }

    async function update(id: string, changes: Partial<Project>) {
      const result = await window.api.updateProject(id, changes);
      if (result.ok) {
        const idx = projects.value.findIndex((p) => p._id === id);
        if (idx >= 0) projects.value[idx] = result.project;
      }
      return result;
    }

    async function remove(id: string) {
      const result = await window.api.deleteProject(id);
      if (result.ok) {
        projects.value = projects.value.filter((p) => p._id !== id);
      }
      return result;
    }

    return { projects, isLoading, fetch, create, update, remove };
  });
  ```
  ```ts
  // src/renderer/src/stores/useTaskStore.ts
  import { defineStore } from 'pinia';
  import { ref, computed } from 'vue';
  import type { Task } from '../../../shared/types';

  export const useTaskStore = defineStore('task', () => {
    const tasks = ref<Task[]>([]);
    const isLoading = ref(false);
    const currentProjectId = ref<string | null>(null);

    const filteredTasks = computed(() => {
      if (!currentProjectId.value) return tasks.value;
      return tasks.value.filter((t) => t.projectId === currentProjectId.value);
    });

    async function fetch(projectId?: string) {
      isLoading.value = true;
      const result = await window.api.listTasks(projectId);
      if (result.ok) tasks.value = result.tasks;
      isLoading.value = false;
    }

    async function create(doc: Parameters<typeof window.api.createTask>[0]) {
      const result = await window.api.createTask(doc);
      if (result.ok) tasks.value.push(result.task);
      return result;
    }

    async function updateStatus(id: string, status: Task['status']) {
      const result = await window.api.updateTask(id, { status });
      if (result.ok) {
        const idx = tasks.value.findIndex((t) => t._id === id);
        if (idx >= 0) tasks.value[idx] = result.task;
      }
      return result;
    }

    async function remove(id: string) {
      const result = await window.api.deleteTask(id);
      if (result.ok) {
        tasks.value = tasks.value.filter((t) => t._id !== id);
      }
      return result;
    }

    return { tasks, isLoading, currentProjectId, filteredTasks, fetch, create, updateStatus, remove };
  });
  ```
- **MIRROR**: Phase 1 PINIA_STORE_PATTERN（setup store + ref + onScopeDispose）
- **IMPORTS**: 见各 store 文件
- **GOTCHA**:
  - Store 里的数组操作必须返回新数组（不可变），如 `projects.value = projects.value.filter(...)` 而非 `splice`
  - `useAuthStore.register` 注册成功后自动调用 `login`，减少用户操作步骤
  - `useTaskStore.updateStatus` 是状态流转的核心方法；Phase 3 UI 按钮和 Phase 4 引擎都会调用它
  - `fetch()` 应在登录成功后、页面挂载时调用；不要在 store 的 setup 里自动调用（避免副作用）
- **VALIDATE**:
  ```bash
  npx vue-tsc --noEmit
  ```

### Task 11: 更新 Router（登录态守卫 + 新路由）

- **ACTION**: 修改 `src/renderer/src/router/index.ts`
- **IMPLEMENT**:
  ```ts
  import { createRouter, createWebHashHistory } from 'vue-router';
  import { useAuthStore } from '../stores/useAuthStore';

  const LoginView = () => import('../views/LoginView.vue');
  const HomeView = () => import('../views/HomeView.vue');
  const ProjectsView = () => import('../views/ProjectsView.vue');
  const TasksView = () => import('../views/TasksView.vue');

  export const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
      { path: '/', name: 'home', component: HomeView },
      { path: '/projects', name: 'projects', component: ProjectsView },
      { path: '/tasks', name: 'tasks', component: TasksView },
    ],
  });

  router.beforeEach((to) => {
    const auth = useAuthStore();
    if (!auth.currentUser && !to.meta.public) {
      return { name: 'login' };
    }
    if (auth.currentUser && to.name === 'login') {
      return { name: 'home' };
    }
  });
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN + vue-router 官方用法
- **IMPORTS**: 见上
- **GOTCHA**:
  - Electron 渲染进程**必须**用 `createWebHashHistory`，不能用 `createWebHistory`（`file://` 协议不支持 history 模式）
  - `router.beforeEach` 里不要调用 `auth.checkSession()`（避免每次导航都发 IPC）；session 检查应在 `App.vue` 的 `onMounted` 里做一次
  - 已登录用户访问 `/login` 应自动跳首页；未登录用户访问任何非 public 路由应跳登录页
  - 路由组件用 `() => import(...)` 懒加载，减少首屏 bundle
- **VALIDATE**:
  ```bash
  npx vue-tsc --noEmit
  ```

### Task 12: 创建 LoginView.vue

- **ACTION**: 新建 `src/renderer/src/views/LoginView.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { ref } from 'vue';
  import { useAuthStore } from '../stores/useAuthStore';

  const auth = useAuthStore();
  const isRegister = ref(false);
  const username = ref('');
  const password = ref('');
  const confirmPassword = ref('');

  async function handleSubmit() {
    if (isRegister.value) {
      if (password.value !== confirmPassword.value) {
        auth.error = '两次密码不一致';
        return;
      }
      await auth.register(username.value, password.value);
    } else {
      await auth.login(username.value, password.value);
    }
  }
  </script>

  <template>
    <div class="login-page">
      <h1>ClaudeCode Remote</h1>
      <form class="login-form" @submit.prevent="handleSubmit">
        <h2>{{ isRegister ? '注册' : '登录' }}</h2>
        <input v-model="username" placeholder="用户名" required autocomplete="username" />
        <input v-model="password" type="password" placeholder="密码" required autocomplete="current-password" />
        <input
          v-if="isRegister"
          v-model="confirmPassword"
          type="password"
          placeholder="确认密码"
          required
        />
        <button type="submit" :disabled="auth.isLoading">
          {{ auth.isLoading ? '处理中...' : (isRegister ? '注册' : '登录') }}
        </button>
        <p v-if="auth.error" class="error">{{ auth.error }}</p>
        <p class="toggle">
          {{ isRegister ? '已有账号？' : '还没有账号？' }}
          <a href="#" @click.prevent="isRegister = !isRegister">
            {{ isRegister ? '登录' : '注册' }}
          </a>
        </p>
      </form>
    </div>
  </template>

  <style scoped>
  .login-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
  }
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 300px;
  }
  .login-form input,
  .login-form button {
    padding: 0.5rem;
    font-size: 1rem;
  }
  .error {
    color: #d32f2f;
    font-size: 0.875rem;
  }
  .toggle {
    font-size: 0.875rem;
    text-align: center;
  }
  </style>
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN（`<script setup>` + Composition API）
- **IMPORTS**: `vue`, `../stores/useAuthStore`
- **GOTCHA**:
  - 表单使用 `@submit.prevent` 阻止默认提交（避免页面刷新）
  - 密码输入框加 `autocomplete` 属性帮助浏览器记住密码
  - 错误文案用中文（用户偏好），但不要硬编码在组件里做国际化；Phase 2 直接写中文即可
  - 注册时「两次密码不一致」是客户端校验，不经过 IPC；其它错误（用户名已存在等）来自服务端
  - 样式用 scoped + 简单 flex 布局；Phase 3 再做完整设计系统
- **VALIDATE**: 启动 `npm run dev`，手动测试登录/注册表单

### Task 13: 创建 ProjectsView.vue

- **ACTION**: 新建 `src/renderer/src/views/ProjectsView.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useProjectStore } from '../stores/useProjectStore';
  import ProjectForm from '../components/ProjectForm.vue';

  const projectStore = useProjectStore();
  const showForm = ref(false);

  onMounted(() => projectStore.fetch());
  </script>

  <template>
    <div class="projects-page">
      <header>
        <h2>项目</h2>
        <button @click="showForm = true">+ 新建项目</button>
      </header>

      <ProjectForm v-if="showForm" @submit="showForm = false" @cancel="showForm = false" />

      <div v-if="projectStore.isLoading">加载中...</div>
      <ul v-else class="project-list">
        <li v-for="p in projectStore.projects" :key="p._id" class="project-item">
          <strong>{{ p.name }}</strong>
          <span class="path">{{ p.path }}</span>
          <p v-if="p.description" class="desc">{{ p.description }}</p>
        </li>
      </ul>
    </div>
  </template>

  <style scoped>
  .projects-page { padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .project-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  .project-item { border: 1px solid #ddd; border-radius: 4px; padding: 0.75rem; }
  .path { color: #666; font-size: 0.875rem; margin-left: 0.5rem; }
  .desc { margin: 0.5rem 0 0; color: #444; font-size: 0.875rem; }
  </style>
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN
- **IMPORTS**: `vue`, store, component
- **GOTCHA**:
  - `onMounted(() => projectStore.fetch())` 只在页面挂载时拉数据；如果用户从别的页切回来需要重新拉，可用 `onActivated`（keep-alive）或路由守卫
  - 删除按钮 Phase 3 再加；Phase 2 只做列表展示 + 创建
  - 项目路径输入框在表单组件里用 `<input type="text">`，不做文件选择器（Electron 的 `dialog.showOpenDialog` 通过 IPC 调，Phase 3 再集成）
- **VALIDATE**: `npm run dev` 手动测试

### Task 14: 创建 ProjectForm.vue

- **ACTION**: 新建 `src/renderer/src/components/ProjectForm.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { ref } from 'vue';
  import { useProjectStore } from '../stores/useProjectStore';

  const emit = defineEmits<{ submit: []; cancel: [] }>();
  const projectStore = useProjectStore();

  const name = ref('');
  const path = ref('');
  const description = ref('');

  async function handleSubmit() {
    const result = await projectStore.create({
      name: name.value,
      path: path.value,
      description: description.value || undefined,
    });
    if (result.ok) {
      name.value = '';
      path.value = '';
      description.value = '';
      emit('submit');
    }
  }
  </script>

  <template>
    <form class="project-form" @submit.prevent="handleSubmit">
      <input v-model="name" placeholder="项目名称" required />
      <input v-model="path" placeholder="本地路径（如 /path/to/project）" required />
      <textarea v-model="description" placeholder="描述（可选）" rows="2" />
      <div class="actions">
        <button type="submit">创建</button>
        <button type="button" @click="emit('cancel')">取消</button>
      </div>
    </form>
  </template>

  <style scoped>
  .project-form { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
  .project-form input, .project-form textarea { padding: 0.5rem; font-size: 1rem; }
  .actions { display: flex; gap: 0.5rem; }
  </style>
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN
- **IMPORTS**: `vue`, store
- **GOTCHA**:
  - `path` 字段不做路径存在性校验（Phase 2 简化）；Phase 4 引擎启动前再校验
  - `description` 为空字符串时传 `undefined`，避免存空字符串进 DB
  - 表单提交成功后清空字段并 emit `submit` 通知父组件关闭表单
- **VALIDATE**: `npm run dev` 手动测试

### Task 15: 创建 TasksView.vue + TaskForm.vue

- **ACTION**: 新建 `src/renderer/src/views/TasksView.vue` 和 `src/renderer/src/components/TaskForm.vue`
- **IMPLEMENT**:
  ```vue
  <!-- TasksView.vue -->
  <script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useTaskStore } from '../stores/useTaskStore';
  import { useProjectStore } from '../stores/useProjectStore';
  import TaskForm from '../components/TaskForm.vue';

  const taskStore = useTaskStore();
  const projectStore = useProjectStore();
  const showForm = ref(false);

  onMounted(() => {
    taskStore.fetch();
    projectStore.fetch();
  });
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

      <div v-if="taskStore.isLoading">加载中...</div>
      <ul v-else class="task-list">
        <li v-for="t in taskStore.tasks" :key="t._id" class="task-item">
          <span class="status" :class="t.status">{{ t.status }}</span>
          <strong>{{ t.title }}</strong>
          <span class="project">{{ t.projectId }}</span>
        </li>
      </ul>
    </div>
  </template>
  ```
  ```vue
  <!-- TaskForm.vue -->
  <script setup lang="ts">
  import { ref } from 'vue';
  import { useTaskStore } from '../stores/useTaskStore';
  import type { Project } from '../../../shared/types';

  const props = defineProps<{ projects: Project[] }>();
  const emit = defineEmits<{ submit: []; cancel: [] }>();
  const taskStore = useTaskStore();

  const title = ref('');
  const description = ref('');
  const prompt = ref('');
  const projectId = ref('');

  async function handleSubmit() {
    const result = await taskStore.create({
      title: title.value,
      description: description.value || undefined,
      prompt: prompt.value,
      projectId: projectId.value,
    });
    if (result.ok) {
      title.value = '';
      description.value = '';
      prompt.value = '';
      projectId.value = '';
      emit('submit');
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
        <button type="submit">创建</button>
        <button type="button" @click="emit('cancel')">取消</button>
      </div>
    </form>
  </template>
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN
- **IMPORTS**: 见代码
- **GOTCHA**:
  - `prompt` 字段是任务的核心 —— 这就是传给 Claude Code 的实际指令；必须必填
  - `projectId` 用 `<select>` 下拉选择；如果没有项目，提示用户先创建项目
  - 任务状态默认 `planned`（由服务端在 IPC handler 里填充），创建时不需要用户选
  - `taskStore.tasks` 按创建时间排序可在 store 的 `fetch` 后加 `.sort((a, b) => ...)`
- **VALIDATE**: `npm run dev` 手动测试

### Task 16: 更新 App.vue（登录态布局）

- **ACTION**: 修改 `src/renderer/src/App.vue`
- **IMPLEMENT**:
  ```vue
  <script setup lang="ts">
  import { onMounted } from 'vue';
  import { useAuthStore } from './stores/useAuthStore';

  const auth = useAuthStore();
  onMounted(() => auth.checkSession());
  </script>

  <template>
    <div class="app">
      <template v-if="auth.currentUser">
        <aside class="sidebar">
          <nav>
            <RouterLink to="/">首页</RouterLink>
            <RouterLink to="/projects">项目</RouterLink>
            <RouterLink to="/tasks">任务</RouterLink>
          </nav>
          <div class="user">
            <span>{{ auth.currentUser.username }}</span>
            <button @click="auth.logout()">注销</button>
          </div>
        </aside>
        <main class="main">
          <RouterView />
        </main>
      </template>
      <template v-else>
        <RouterView />
      </template>
    </div>
  </template>

  <style>
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 200px; background: #f5f5f5; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; }
  .sidebar nav { display: flex; flex-direction: column; gap: 0.5rem; }
  .sidebar a { text-decoration: none; color: #333; padding: 0.5rem; border-radius: 4px; }
  .sidebar a:hover, .sidebar a.router-link-active { background: #e0e0e0; }
  .user { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; }
  .main { flex: 1; padding: 1rem; overflow: auto; }
  </style>
  ```
- **MIRROR**: Phase 1 VUE_COMPONENT_PATTERN
- **IMPORTS**: `vue`, `useAuthStore`
- **GOTCHA**:
  - `onMounted(() => auth.checkSession())` 在应用启动时自动检查 session；如果 CouchDB cookie 仍有效，自动恢复登录态并触发 sync
  - `auth.logout()` 后 `currentUser` 变 null，router guard 会把用户踢到登录页
  - 侧边栏只在已登录时显示；未登录时全屏显示登录表单
  - 样式用全局 `<style>`（非 scoped），因为 `.app` / `.sidebar` 是顶层布局元素
- **VALIDATE**: `npm run dev` 启动后：
  1. 首次访问显示登录页
  2. 登录成功后显示侧边栏 + 首页
  3. 刷新页面后自动恢复 session（如果 cookie 未过期）
  4. 点击注销后回到登录页

### Task 17: 更新环境变量模板

- **ACTION**: 修改 `.env.example`
- **IMPLEMENT**:
  ```bash
  # CouchDB 连接（可带库名，程序会自动提取 base URL）
  COUCHDB_URL=http://localhost:5984/cc-remote
  COUCHDB_USER=replace_me
  COUCHDB_PASSWORD=replace_me

  # CouchDB Admin（用于创建用户 DB；如已启用 couch_peruser 可留空）
  COUCHDB_ADMIN_USER=admin
  COUCHDB_ADMIN_PASSWORD=replace_me
  ```
- **MIRROR**: Phase 1 Task 10（`.env.example` 模式）
- **IMPORTS**: N/A
- **GOTCHA**:
  - `.env` 文件（带真实值）不能 commit；只在本地使用
  - `COUCHDB_ADMIN_*` 用于在用户注册后手动创建 `userdb-<hex>`（当 couch_peruser 未启用时的 fallback）
  - 如果 CouchDB 已启用 `couch_peruser`，`COUCHDB_ADMIN_*` 可不填
- **VALIDATE**:
  ```bash
  grep -q "COUCHDB_ADMIN_USER" .env.example && echo "ok"
  ```

### Task 18: 写 Repository 单元测试

- **ACTION**: 新建 `src/main/repositories/__tests__/baseRepository.test.ts`
- **IMPLEMENT**:
  ```ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import PouchDB from 'pouchdb';
  import PouchDBMemory from 'pouchdb-adapter-memory';
  import { BaseRepository } from '../baseRepository';

  PouchDB.plugin(PouchDBMemory);

  interface TestDoc {
    _id: string;
    _rev: string;
    type: 'test';
    name: string;
  }

  describe('BaseRepository', () => {
    let db: PouchDB.Database;
    let repo: BaseRepository<TestDoc>;

    beforeEach(async () => {
      db = new PouchDB('memory:test', { adapter: 'memory' });
      repo = new BaseRepository<TestDoc>(db, 'test');
    });

    it('findAll returns empty array when no docs', async () => {
      const docs = await repo.findAll();
      expect(docs).toEqual([]);
    });

    it('creates and finds a doc', async () => {
      const created = await repo.create({ type: 'test', name: 'hello' });
      expect(created._id).toMatch(/^test:/);
      expect(created.name).toBe('hello');

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('hello');
    });

    it('findById returns null for missing doc', async () => {
      const doc = await repo.findById('test:nonexistent');
      expect(doc).toBeNull();
    });

    it('updates a doc', async () => {
      const created = await repo.create({ type: 'test', name: 'before' });
      const updated = await repo.update(created._id, { name: 'after' });
      expect(updated.name).toBe('after');
      expect(updated._rev).not.toBe(created._rev);
    });

    it('deletes a doc', async () => {
      const created = await repo.create({ type: 'test', name: 'todelete' });
      await repo.delete(created._id);
      const doc = await repo.findById(created._id);
      expect(doc).toBeNull();
    });
  });
  ```
- **MIRROR**: Phase 1 TEST_STRUCTURE（AAA + vitest）
- **IMPORTS**:
  ```bash
  npm install -D pouchdb-adapter-memory
  ```
- **GOTCHA**:
  - `pouchdb-adapter-memory` 是测试专用依赖，开发依赖
  - 每个 `beforeEach` 新建内存 DB，测试之间完全隔离
  - 不测试真实 CouchDB 连接（那是集成测试范畴）；内存 adapter 足够验证 CRUD 逻辑
  - 如需测 `findAll` 的过滤逻辑，可以插入 `other:` 前缀的 doc，验证它不会被返回
- **VALIDATE**:
  ```bash
  npx vitest run src/main/repositories/__tests__/baseRepository.test.ts
  # 期望：5 个测试全部通过
  ```

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| BaseRepository.findAll empty | 空 DB | `[]` | Yes |
| BaseRepository.create assigns type prefix | `{ type: 'test', name: 'x' }` | `_id` starts with `test:` | No |
| BaseRepository.findById missing | `'test:nonexistent'` | `null` | Yes |
| BaseRepository.update changes rev | 已存在的 doc | 新 `_rev`，字段更新 | No |
| BaseRepository.delete removes doc | 已存在的 doc | `findById` 返回 null | No |
| SyncManager.switchToUser | username + password | 新 local DB，新 remote DB，sync 启动 | No |
| SyncManager.logout | — | sync 停止，状态为 idle | No |
| AuthManager.getSession no cookie | — | `null` | Yes |

### Edge Cases Checklist

- [ ] 用户未登录时调用 project:list → 返回 `{ ok: false, error: '未登录' }`
- [ ] 注册已存在的用户名 → pouchdb-authentication 报错，错误 message 透传
- [ ] 登录密码错误 → 报错，不切换 sync
- [ ] 网络断开时 sync → 进入 `error` 状态，不会 crash
- [ ] 两个用户先后登录 → 前一个用户的 sync 正确停止，数据不泄漏
- [ ] 用户注销后重新登录 → 能正确恢复到用户专属 DB
- [ ] project 删除后，关联 task 的 `projectId` 变成悬空引用 → Phase 3 加级联提示
- [ ] 同一用户多设备登录 → CouchDB 会自动处理冲突（last-write-wins）；Phase 10 再考虑更精细的冲突策略

---

## Validation Commands

### Static Analysis
```bash
cd /d/Workspace/canger/claudecode-remote
npx vue-tsc --noEmit
```
EXPECT: 0 类型错误

```bash
npx tsc --noEmit -p tsconfig.node.json
```
EXPECT: 0 类型错误（main + preload）

### Lint
```bash
npm run lint
```
EXPECT: 0 错误

### Unit Tests
```bash
npx vitest run
```
EXPECT: BaseRepository 5 个测试全部通过；无 fail

### Dev Server (Browser Validation)
```bash
npm run dev
```
EXPECT:
- Electron 窗口出现
- 未登录状态显示登录页
- 注册新用户 → 登录成功 → 显示侧边栏
- 创建项目 → 项目出现在列表中
- 创建任务 → 任务出现在列表中
- 注销 → 回到登录页
- 重新登录 → 数据仍在（从本地 PouchDB 恢复）

### CouchDB 连通性手测
```bash
# 1. 验证 couch_peruser 启用状态
curl -u "admin:password" "http://localhost:5984/_node/_local/_config/couch_peruser"
# 期望返回 { "enable": "true" } 或类似

# 2. 注册一个用户后检查用户 DB 是否自动创建
curl -u "admin:password" "http://localhost:5984/_all_dbs"
# 期望看到 userdb-616c696365（假设用户名 alice）
```

### 数据隔离验证
```bash
# 1. 用 userA 登录，创建项目 projA
# 2. 注销，用 userB 注册/登录
# 3. 检查项目列表 —— 不应看到 projA
```

### Manual Validation
- [ ] 启动应用显示登录页
- [ ] 注册新用户成功，自动登录，侧边栏出现
- [ ] 创建 2 个项目，列表正确显示
- [ ] 创建 2 个任务（绑定不同项目），列表正确显示
- [ ] 注销后重新登录，数据仍在
- [ ] 注册第二个用户，登录后看不到第一个用户的数据
- [ ] 同步状态显示正常（connecting → active/paused）
- [ ] CouchDB 服务器上能看到两个独立的 userdb-xxx 库

---

## Acceptance Criteria

- [ ] Task 1-18 全部完成
- [ ] `npx vue-tsc --noEmit` 0 错误
- [ ] `npx tsc --noEmit -p tsconfig.node.json` 0 错误
- [ ] `npx vitest run` 全部通过
- [ ] `npm run dev` 能完整跑通「注册 → 登录 → 创建项目 → 创建任务 → 注销 → 重登 → 数据仍在」流程
- [ ] 多用户数据隔离验证通过（userA 看不到 userB 的数据）
- [ ] PRD Phase 2 行的状态更新为 `complete`，PRP Plan 列填入本文件路径

## Completion Checklist

- [ ] 代码遵循 Phase 1 NAMING_CONVENTION（camelCase 文件、PascalCase 组件）
- [ ] 错误显式处理，不静默吞掉（所有 IPC handler 有 try/catch，返回 `{ ok, error }`）
- [ ] PouchDB 实例只在主进程，渲染进程通过 IPC 间接访问
- [ ] preload `contextBridge` 暴露白名单 API，不暴露 `ipcRenderer` 全集
- [ ] 没有把 CouchDB 密码写进任何 commit（`.env` 在 `.gitignore` 中）
- [ ] Repository 层不可变：`update` 返回新对象，`filter` 返回新数组
- [ ] Store 不可变：`projects.value = [...]` 而非 `splice`
- [ ] 文档 schema 的 `_id` 含 `type:` 前缀，支持 `allDocs` 前缀查询
- [ ] 没有引入「任务引擎」、「状态自动流转」、「子任务」等 Phase 3+ 功能

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| pouchdb-authentication 与 PouchDB v9 类型不兼容 | M | 编译报错 | 用 `as any` 或自定义 `.d.ts` 扩展 |
| CouchDB 未启用 `couch_peruser` → 用户注册后无个人 DB | H | 登录后 sync 404 | README 前置条件说明 + admin fallback 创建 DB |
| cookie session TTL 太短（默认 10 分钟）→ 刷新页面需重登 | M | 用户体验差 | 文档化 CouchDB `timeout` 配置可调长 |
| 同项目多任务并发冲突 | L（本阶段） | Phase 4 才涉及 | 本阶段只创建任务，不执行；Phase 4 plan 处理 |
| LevelDB 多用户本地数据目录冲突 | L | 数据污染 | 本地 DB 名用 `cc-remote-${username}` 隔离 |
| electron-vite HMR 时 IPC handler 重复注册 | M | dev 报错 | 每个 handler 注册前 `removeHandler` |

## Notes

- **与 Phase 1 的衔接**：本 plan 假设 Phase 1 的 `src/main/db.ts`、`src/main/ipc.ts`、`src/preload/index.ts` 已按 Phase 1 plan 落地。如果 Phase 1 实际代码与 plan 有出入（如文件名、导出方式不同），需相应调整 import 路径。
- **couch_peruser 前置条件**：CouchDB 服务器必须启用 `[couch_peruser] enable = true`。应在项目 README 中写明配置步骤。如果用户无法启用，AuthManager 的 `signUp` 后需用 admin 凭据手动 `PUT /userdb-<hex>`。
- **Session 恢复策略**：Phase 2 使用 CouchDB cookie session（由 `pouchdb-authentication` 管理）。如果 cookie 过期，用户需重新登录。后续版本可考虑用 Electron 的 `safeStorage` 存密码实现自动登录。
- **本地数据清理**：用户切换账号时，旧账号的本地 LevelDB 数据（`cc-remote-olduser/`）不会自动删除。这是设计如此——支持离线切换。如需清理，可后续加「清除本地缓存」功能。
- **数据模型预留**：Task 已包含 `claudeSessionId`、`logs`、`reviewFeedback` 等 Phase 8/9 才使用的字段；Phase 2 只存默认值（null/[]），不实现相关功能。
- **下一步衔接**：Phase 3 在本 plan 落地基础上加 ① 完整桌面 UI（编辑/删除/状态流转按钮）② 项目设置页 ③ 任务详情页；Phase 4 在此基础上加任务引擎。