# Plan: Phase 1 — 基础脚手架 + 主进程 PouchDB 实例化

## Summary

搭建 ClaudeCode Remote 的 Electron + Vue 3 桌面骨架，并在主进程实例化一个 PouchDB 实例双向同步到用户自建的 CouchDB；通过 IPC 把 sync 状态推到渲染进程，让 Phase 2 数据层落地时能"插得进去"。本阶段是后续所有功能（任务 CRUD、引擎、PWA）的地基。

## User Story

As a Claude Code 多项目开发者（也是首位试用者），
I want 打开 `npm run dev` 就能看到一个 Electron 窗口、并且看到主进程已经把本地 PouchDB 同步到我自建的 CouchDB，
So that 我对项目骨架可用性有底；后续 Phase 2 加 schema/auth、Phase 3 写 UI 时直接复用，不用回头改架构。

## Problem → Solution

**Current state**: `D:\Workspace\canger\claudecode-remote` 目录里只有 `.claude/`（PRD + settings.json），没有任何源码。

**Desired state**: 一个 `npm run dev` 跑得起来的 Electron + Vue 3 + Vite 项目，主进程跑 PouchDB（LevelDB 本地适配器）→ HTTP 同步到 `${COUCHDB_URL}` → 渲染进程通过 IPC 实时拿到 sync 状态并显示在首屏。

## Metadata

- **Complexity**: Medium（greenfield，文件多但都是模板化骨架）
- **Source PRD**: `.claude/PRPs/prds/claudecode-remote.prd.md`
- **PRD Phase**: Phase 1 — 基础脚手架（用户决策扩展到包含 PouchDB 实例化）
- **Estimated Files**: ~22 个新建文件（含脚手架自动生成）
- **Time Estimate**: 1.0 ~ 1.5 天（Phase 1 + Phase 2 边界部分）

---

## UX Design

### Before
```
┌─────────────────────────────────┐
│  D:\...\claudecode-remote\      │
│  └─ .claude/                    │
│     ├─ PRPs/prds/...prd.md      │
│     └─ settings.json            │
│  (无源码，无窗口可开)            │
└─────────────────────────────────┘
```

### After
```
┌────────────────────────────────────────────┐
│ ClaudeCode Remote (Electron 窗口)          │
├────────────────────────────────────────────┤
│                                            │
│   🟢 已连接 CouchDB                         │
│   couch.example.com                        │
│                                            │
│   同步状态：active                          │
│   最近变更：2 个文档（push）                 │
│   错误：—                                  │
│                                            │
│   [刷新连接]                                │
│                                            │
└────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint | Before | After | Notes |
|---|---|---|---|
| 启动应用 | 无 | `npm run dev` → 出现窗口 | dev 模式 |
| CouchDB 连通性 | 无 | 首屏看 sync 状态 | live + retry |
| 配置 | 无 | `.env` 里改 `COUCHDB_URL` 即生效 | 重启 main 进程 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/claudecode-remote.prd.md` | all | 整体目标、非范围、Phase 边界 |
| P0 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 186-190 | Phase 1 原始 scope（"跑得起来的 Electron 空壳 + 本地 CouchDB"） |
| P0 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 191-194 | Phase 2 边界（DB schema、auth 不在本阶段） |
| P1 | `.claude/PRPs/prds/claudecode-remote.prd.md` | 250-264 | Decisions Log（Electron 主进程跑引擎 + PouchDB；这影响主进程模块组织） |
| P2 | `D:\Workspace\canger\nuxt-target\nuxt-target\CLAUDE.md` | all | 用户在另一项目使用的编码规范（中文回复、Zod 校验、不可变模式、80% 覆盖率）— 同样适用本项目 |

## External Documentation

> 由于本项目 greenfield，所有"参考实现"必须来自外部权威源，不能凭空发明。

| Topic | Source | Key Takeaway |
|---|---|---|
| Electron + Vite + Vue 官方脚手架 | https://electron-vite.org/guide/ + `@quick-start/create-electron` | 用 `npm create @quick-start/electron@latest <name> -- --template vue-ts` 生成项目 |
| 标杆 boilerplate（项目结构） | https://github.com/electron-vite/electron-vite-vue | `electron/main`, `electron/preload`, `src/`（renderer）三段式目录 |
| 完整模板（Pinia/Router/Tailwind） | https://github.com/shamscorner/electron-vite-ts-stackter | 我们采纳其 Pinia + Router 集成方式作为参考 |
| PouchDB 在 Electron 中运行 | https://pouchdb.com/learn.html | 主进程用 Node 适配器；遇 LevelDB 原生模块版本不匹配时 `electron-rebuild` |
| CouchDB 认证 | https://github.com/pouchdb-community/pouchdb-authentication | Cookie 认证优于 Basic Auth；`db.logIn()` 调 `/_session` |
| PouchDB sync API | https://terreii.github.io/use-pouchdb/docs/basics/sync | `localDB.sync(remoteDB, { live: true, retry: true })` 监听 `change/active/paused/denied/error` |
| CouchDB couch_peruser | https://medium.com/offline-camp/couchdb-pouchdb-and-hoodie-as-a-stack-for-progressive-web-apps-a6078a985f18 | DPU 模式：CouchDB v3+ 配置项 `couch_peruser`，每用户一个 `userdb-<hex>` 库（Phase 2 启用，Phase 1 仅准备好接入点） |

```
KEY_INSIGHT: 在 Electron 主进程跑 PouchDB（LevelDB 适配器）有"原生模块版本不匹配"风险（apache/pouchdb#5496）
APPLIES_TO: Task 3（实例化 PouchDB）+ Task 12（验证）
GOTCHA: 安装后第一次跑若报 NODE_MODULE_VERSION 不匹配，运行 `npx electron-rebuild`；electron-vite 的 build hook 通常已自动处理，但仍要在故障排查列表里有

KEY_INSIGHT: PouchDB 同步事件名是 'change' / 'active' / 'paused' / 'denied' / 'error' / 'complete'
APPLIES_TO: Task 4（IPC 桥）
GOTCHA: 'paused' 不是出错；它意味着同步完毕进入空闲。UI 文案别写"暂停=异常"

KEY_INSIGHT: electron-vite 模板里渲染进程默认禁用 nodeIntegration；所有 Node API（含 PouchDB）必须留在主进程
APPLIES_TO: 整个 Phase 1 架构
GOTCHA: 不要在 src/renderer/ 里直接 import 'pouchdb'；只能通过 preload 暴露的 IPC API 间接访问
```

---

## Patterns to Mirror

> Greenfield 项目，无内部代码可镜像；所有 pattern 来源标记为外部 boilerplate。

### NAMING_CONVENTION
**SOURCE**: https://github.com/electron-vite/electron-vite-vue（README 项目结构 + 文件名）

```
src/
├── main/
│   ├── index.ts          # camelCase 文件，单一职责入口
│   └── db.ts             # 模块化拆分
├── preload/
│   └── index.ts
└── renderer/
    ├── src/
    │   ├── App.vue       # 组件 PascalCase
    │   ├── main.ts       # 入口 lowercase
    │   ├── views/
    │   │   └── HomeView.vue
    │   ├── components/
    │   ├── stores/       # Pinia store，文件名 camelCase（如 useSyncStore.ts）
    │   └── types/
    └── index.html
```

- 文件名：camelCase（`db.ts`、`useSyncStore.ts`）
- Vue 组件：PascalCase（`HomeView.vue`）
- 类型：`PascalCase` interface
- 常量：`UPPER_SNAKE_CASE`

### IPC_BRIDGE_PATTERN
**SOURCE**: https://github.com/electron-vite/electron-vite-vue/blob/main/electron/preload/index.ts（标准 contextBridge.exposeInMainWorld）

```ts
// preload/index.ts —— 在 contextBridge 上注册 API
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  onSyncStatus: (cb: (status: SyncStatus) => void) => {
    const listener = (_: unknown, status: SyncStatus) => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.off('sync:status', listener) // 必须返回清理函数
  },
  refreshSync: () => ipcRenderer.invoke('sync:refresh'),
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

### MAIN_IPC_HANDLER_PATTERN
**SOURCE**: 综合 electron-vite-vue + Electron 官方 docs

```ts
// main/ipc.ts —— 统一注册 IPC handler，避免散落
import { ipcMain, BrowserWindow } from 'electron'
import { syncManager } from './db'

export function registerIpcHandlers(win: BrowserWindow) {
  ipcMain.handle('sync:refresh', async () => {
    await syncManager.restart()
    return { ok: true }
  })

  syncManager.on('status', (status) => {
    if (!win.isDestroyed()) win.webContents.send('sync:status', status)
  })
}
```

### POUCHDB_SYNC_PATTERN
**SOURCE**: https://terreii.github.io/use-pouchdb/docs/basics/sync + pouchdb-community/pouchdb-authentication README

```ts
// main/db.ts —— PouchDB 实例化 + 同步事件管理
import PouchDB from 'pouchdb'
import { EventEmitter } from 'node:events'

export type SyncStatus =
  | { phase: 'connecting' }
  | { phase: 'active'; lastChange?: number }
  | { phase: 'paused' }
  | { phase: 'error'; message: string }

class SyncManager extends EventEmitter {
  private local: PouchDB.Database
  private remote: PouchDB.Database
  private handle?: PouchDB.Replication.Sync<{}>

  constructor(localPath: string, remoteUrl: string, auth?: { username: string; password: string }) {
    super()
    this.local = new PouchDB(localPath)
    this.remote = new PouchDB(remoteUrl, auth ? { auth } : undefined)
  }

  start() {
    this.emit('status', { phase: 'connecting' })
    this.handle = this.local
      .sync(this.remote, { live: true, retry: true })
      .on('change', (info) => this.emit('status', { phase: 'active', lastChange: info.change.docs.length }))
      .on('paused', () => this.emit('status', { phase: 'paused' }))
      .on('active', () => this.emit('status', { phase: 'active' }))
      .on('denied', (err) => this.emit('status', { phase: 'error', message: `denied: ${err.reason}` }))
      .on('error', (err) => this.emit('status', { phase: 'error', message: String(err) }))
  }

  async restart() {
    this.handle?.cancel()
    this.start()
  }
}

export const syncManager = new SyncManager(
  /* localPath: */ 'cc-remote-local',
  /* remoteUrl */ process.env.COUCHDB_URL || 'http://localhost:5984/cc-remote',
  process.env.COUCHDB_USER && process.env.COUCHDB_PASSWORD
    ? { username: process.env.COUCHDB_USER, password: process.env.COUCHDB_PASSWORD }
    : undefined,
)
```

### PINIA_STORE_PATTERN
**SOURCE**: https://stackblitz.com/github/piniajs/example-vue-3-vite + shamscorner/electron-vite-ts-stackter

```ts
// renderer/src/stores/useSyncStore.ts
import { defineStore } from 'pinia'
import { ref, onScopeDispose } from 'vue'

interface SyncStatus { phase: string; lastChange?: number; message?: string }

export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>({ phase: 'connecting' })

  // 安装监听器；Pinia setup 模式中，组件卸载时不会触发清理 → 用 onScopeDispose 兜底
  const off = window.api.onSyncStatus((s) => { status.value = s })
  onScopeDispose(() => off())

  async function refresh() {
    await window.api.refreshSync()
  }

  return { status, refresh }
})
```

### VUE_COMPONENT_PATTERN
**SOURCE**: Vue 3 官方风格（`<script setup>` + Composition API）

```vue
<!-- renderer/src/views/HomeView.vue -->
<script setup lang="ts">
import { useSyncStore } from '../stores/useSyncStore'
import { storeToRefs } from 'pinia'

const store = useSyncStore()
const { status } = storeToRefs(store)
</script>

<template>
  <main class="home">
    <h1>ClaudeCode Remote</h1>
    <section class="sync-card">
      <span :class="['dot', status.phase]" />
      <p>同步状态: {{ status.phase }}</p>
      <p v-if="status.lastChange != null">最近变更 {{ status.lastChange }} 个文档</p>
      <p v-if="status.message" class="error">错误: {{ status.message }}</p>
      <button @click="store.refresh">刷新连接</button>
    </section>
  </main>
</template>
```

### TYPE_DEFINITIONS_PATTERN
**SOURCE**: electron-vite-vue 官方 preload 类型扩展模式

```ts
// renderer/src/types/api.d.ts
import type { Api } from '../../../preload/index'

declare global {
  interface Window {
    api: Api
  }
}

export {}
```

### TEST_STRUCTURE
**SOURCE**: nuxt-target CLAUDE.md（用户其它项目同用的 Vitest 风格）

```ts
// 单元测试 AAA 结构（来自 ECC common/testing.md）
import { describe, it, expect, vi } from 'vitest'
import { SyncManager } from './db'

describe('SyncManager', () => {
  it('emits connecting status when start() is called', () => {
    // Arrange
    const sm = new SyncManager('memory:local', 'memory:remote')
    const events: string[] = []
    sm.on('status', (s) => events.push(s.phase))

    // Act
    sm.start()

    // Assert
    expect(events[0]).toBe('connecting')
  })
})
```

### ERROR_HANDLING
**SOURCE**: ECC common/coding-style.md（用户全局规则）

```ts
// 主进程：错误必须显式处理，不静默吞掉，写到 logs（Phase 9 之前先用 console.error）
syncManager.on('status', (s) => {
  if (s.phase === 'error') {
    console.error('[sync] error:', s.message) // Phase 9 替换为结构化 log
  }
  win.webContents.send('sync:status', s)
})

// 渲染进程：UI 显示 user-friendly 文案，不直接抛 stack trace
const errorText = computed(() =>
  status.value.phase === 'error' ? `连接失败：${status.value.message}` : null,
)
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | CREATE（脚手架生成） | 项目元数据 + 脚本 |
| `electron.vite.config.ts` | CREATE（脚手架生成，需调整） | electron-vite 三段式构建配置 |
| `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json` | CREATE（脚手架生成） | TS 多 project 引用 |
| `.gitignore` | CREATE | 排除 `out/`, `dist/`, `node_modules/`, `.env`, `cc-remote-local/`（PouchDB 本地数据） |
| `.env.example` | CREATE | `COUCHDB_URL`, `COUCHDB_USER`, `COUCHDB_PASSWORD` 模板 |
| `.env` | CREATE 本地（不入库） | 用户自建 CouchDB 凭据 |
| `src/main/index.ts` | CREATE（脚手架基础上扩展） | Electron 主进程入口 + 调起 syncManager |
| `src/main/db.ts` | CREATE | PouchDB + SyncManager 类 |
| `src/main/ipc.ts` | CREATE | 集中注册 IPC handler |
| `src/preload/index.ts` | CREATE（脚手架基础上扩展） | contextBridge 暴露 API |
| `src/preload/index.d.ts` | CREATE | 导出 Api 类型 |
| `src/renderer/index.html` | CREATE（脚手架生成） | 渲染入口 HTML |
| `src/renderer/src/main.ts` | CREATE（脚手架基础上扩展） | 注册 Pinia + Router |
| `src/renderer/src/App.vue` | CREATE（脚手架生成） | 顶层组件 |
| `src/renderer/src/views/HomeView.vue` | CREATE | 首屏：sync 状态卡片 |
| `src/renderer/src/stores/useSyncStore.ts` | CREATE | sync 状态 Pinia store |
| `src/renderer/src/types/api.d.ts` | CREATE | window.api 类型增强 |
| `src/renderer/src/router/index.ts` | CREATE | vue-router（仅 `/`，为 Phase 3 准备） |
| `src/renderer/src/style.css` | CREATE（脚手架生成） | 基础样式 |
| `electron-builder.yml` | CREATE（脚手架生成） | Phase 1 不打包，但保留配置占位 |
| `README.md` | CREATE | dev 启动指南 + 环境变量说明 |
| `.editorconfig` | CREATE（脚手架生成） | 编辑器统一缩进 |

## NOT Building

> 严格收紧 Phase 1 范围；这些项**不在**本阶段，避免 scope creep。

- ❌ 用户登录/注册 UI（Phase 2）
- ❌ CouchDB Database-Per-User 切换（Phase 2，本阶段所有开发者共用一个 dev 库）
- ❌ task / project / user 文档 schema 定义（Phase 2）
- ❌ Pinia store 持久化（Phase 2 之后）
- ❌ 任务 CRUD 页面（Phase 3）
- ❌ 任务引擎、`claude -p` 子进程、p-queue（Phase 4）
- ❌ 多 LLM 切换 UI（Phase 5）
- ❌ PWA manifest / service worker（Phase 6）
- ❌ 单元测试覆盖率达标（Phase 1 只跑核心 sanity 测试，覆盖率到 Phase 4 之后再补）
- ❌ 生产打包（`electron-builder` 跑通即可，不出 .exe / .dmg）
- ❌ 自动登录 CouchDB（Phase 2 引入 `pouchdb-authentication`；本阶段用环境变量带凭据）
- ❌ couch_peruser 服务端配置（用户自建 CouchDB 上手动启用，文档化即可）
- ❌ 错误日志结构化（Phase 9 进度日志一并做）

---

## Step-by-Step Tasks

### Task 1: 用 electron-vite 官方脚手架初始化项目

- **ACTION**: 在 `D:\Workspace\canger\claudecode-remote\` **当前目录**生成项目（**不**新建子目录）
- **IMPLEMENT**:
  ```bash
  # 关键：先把脚手架创建到临时目录再合并；避免 .claude/ 被覆盖
  cd /d/Workspace/canger/claudecode-remote
  npm create @quick-start/electron@latest tmp-scaffold -- --template vue-ts --skip
  # --skip 让它跳过自动 install
  # 然后把 tmp-scaffold 内容（除 .git）移到当前目录
  mv tmp-scaffold/* tmp-scaffold/.[!.]* . 2>/dev/null || true
  rm -rf tmp-scaffold
  ```
  > 如果 `--skip` 参数在当前版本无效，去掉它即可，依赖会被自动装上。
- **MIRROR**: 见 NAMING_CONVENTION pattern 与 `electron-vite-vue` 项目结构（搜索结果中的官方 boilerplate）
- **IMPORTS**: 无（脚手架命令）
- **GOTCHA**:
  - **绝对**不要让脚手架覆盖 `.claude/` 目录（PRD + settings 在里面）；建议先 `git status` 确认现有文件，再手动合并
  - 脚手架默认假设 `package.json#name` 等于目录名（合法 npm 名 `claudecode-remote`），ok
  - 脚手架默认会问 ESLint/Prettier；都选 yes
- **VALIDATE**:
  ```bash
  ls D:/Workspace/canger/claudecode-remote/
  # 应该看到：.claude/  src/  electron.vite.config.ts  package.json  tsconfig.*  ...
  test -d .claude && echo "ok: .claude preserved"
  test -f electron.vite.config.ts && echo "ok: scaffold present"
  ```

### Task 2: 安装 Phase 1 必要依赖

- **ACTION**: 在脚手架基础上加 Vue Router、Pinia、PouchDB、PouchDB types
- **IMPLEMENT**:
  ```bash
  npm install vue-router@^4 pinia@^3 pouchdb@^9
  npm install -D @types/pouchdb @types/node electron-rebuild
  ```
- **MIRROR**: shamscorner/electron-vite-ts-stackter 的依赖列表（搜索结果中提到 Vite + TS + Vue-Router + Pinia + ESLint + Prettier）
- **IMPORTS**: N/A
- **GOTCHA**:
  - `pouchdb-authentication` **不**在本阶段安装（Phase 2 才用）
  - `electron-rebuild` 是开发依赖，仅在原生模块版本不匹配时手动调用 `npx electron-rebuild`
  - 不安装 `pouchdb-node`；上游已弃用，直接用 `pouchdb` 主包就含 Node 适配器
- **VALIDATE**:
  ```bash
  npm ls vue-router pinia pouchdb
  # 三者都应在 dependencies 树中显示具体版本，无 UNMET
  ```

### Task 3: 在 `src/main/db.ts` 实现 SyncManager

- **ACTION**: 新建主进程模块，封装 PouchDB 本地实例 + sync 事件管理
- **IMPLEMENT**: 见 `POUCHDB_SYNC_PATTERN` 中的完整代码片段，原样落到 `src/main/db.ts`
- **MIRROR**: POUCHDB_SYNC_PATTERN（external source 已标注）
- **IMPORTS**:
  ```ts
  import PouchDB from 'pouchdb'
  import { EventEmitter } from 'node:events'
  ```
- **GOTCHA**:
  - PouchDB 默认 LevelDB 适配器在 Electron 主进程偶发 `NODE_MODULE_VERSION` 不匹配（apache/pouchdb#5496）；遇到时跑 `npx electron-rebuild`
  - 本地数据写到工作目录（`cc-remote-local`）；**记得加到 `.gitignore`**
  - `process.env.COUCHDB_URL` 在主进程默认能读到；通过 `dotenv` 加载 `.env`（Task 4 处理）
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  # SyncManager 类型必须 0 报错
  ```

### Task 4: 加 dotenv 加载 + IPC handler 注册

- **ACTION**: 让主进程启动时读 `.env`；在 `src/main/ipc.ts` 注册 `sync:status` 推送 + `sync:refresh` invoke handler
- **IMPLEMENT**:
  ```ts
  // src/main/index.ts（在脚手架已有内容基础上加）
  import 'dotenv/config'
  import { syncManager } from './db'
  import { registerIpcHandlers } from './ipc'

  app.whenReady().then(() => {
    const win = createWindow()
    registerIpcHandlers(win)
    syncManager.start()
  })
  ```
  ```ts
  // src/main/ipc.ts —— 见 MAIN_IPC_HANDLER_PATTERN 完整片段
  ```
- **MIRROR**: MAIN_IPC_HANDLER_PATTERN
- **IMPORTS**:
  ```bash
  npm install dotenv
  ```
- **GOTCHA**:
  - `import 'dotenv/config'` 必须在**最顶部**，早于 `./db` 这种会读 env 的模块
  - `BrowserWindow` 销毁后再发送会报错 → 用 `if (!win.isDestroyed())` 守护
  - electron-vite 的 dev 模式 main 进程会热重载；监听器会重复注册，需要 `ipcMain.removeHandler('sync:refresh')` 兜底（或在 `beforeQuit` 清理）
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 5: 在 `src/preload/index.ts` 暴露 API

- **ACTION**: 通过 `contextBridge` 暴露 `window.api`，监听 `sync:status` 事件 + 提供 `sync:refresh` 调用
- **IMPLEMENT**: 见 `IPC_BRIDGE_PATTERN` 完整片段（落到 `src/preload/index.ts`）
- **MIRROR**: IPC_BRIDGE_PATTERN（来自 electron-vite-vue 官方 preload 用法）
- **IMPORTS**:
  ```ts
  import { contextBridge, ipcRenderer } from 'electron'
  ```
- **GOTCHA**:
  - **必须返回清理函数** `off()`；否则 Pinia store 在 HMR 时会泄漏 listener
  - 不要把整个 `ipcRenderer` 暴露出去（脚手架默认有这种"邪恶"模板，删掉）；只暴露白名单的 channel
  - 命名为 `window.api` 而不是默认的 `window.electron`；与 PINIA_STORE_PATTERN 中 `window.api.onSyncStatus` 一致
- **VALIDATE**:
  ```bash
  npx tsc --noEmit -p tsconfig.node.json
  ```

### Task 6: 渲染进程类型增强 `src/renderer/src/types/api.d.ts`

- **ACTION**: 让 TypeScript 认识 `window.api`
- **IMPLEMENT**: 见 `TYPE_DEFINITIONS_PATTERN` 片段
- **MIRROR**: TYPE_DEFINITIONS_PATTERN
- **IMPORTS**: `import type { Api } from '../../../preload/index'`
- **GOTCHA**: 路径相对深度容易写错；用 `tsconfig` 的 `paths` alias 也行，但本阶段保持简单
- **VALIDATE**:
  ```bash
  # 在 HomeView.vue 里输 window.api. 应有自动补全
  npx vue-tsc --noEmit
  ```

### Task 7: Pinia store `useSyncStore`

- **ACTION**: 新建 `src/renderer/src/stores/useSyncStore.ts`
- **IMPLEMENT**: 见 `PINIA_STORE_PATTERN` 完整片段
- **MIRROR**: PINIA_STORE_PATTERN
- **IMPORTS**:
  ```ts
  import { defineStore } from 'pinia'
  import { ref, onScopeDispose } from 'vue'
  ```
- **GOTCHA**: setup 模式下 store 实例是单例，listener 不会随组件卸载自动清；用 `onScopeDispose` 兜底（在 store 被销毁时移除）
- **VALIDATE**:
  ```bash
  npx vue-tsc --noEmit
  ```

### Task 8: `HomeView.vue` 首屏 + Vue Router 路由

- **ACTION**: 新建 `src/renderer/src/views/HomeView.vue` 和 `src/renderer/src/router/index.ts`
- **IMPLEMENT**:
  ```ts
  // router/index.ts
  import { createRouter, createWebHashHistory } from 'vue-router'
  const HomeView = () => import('../views/HomeView.vue')

  export const router = createRouter({
    history: createWebHashHistory(),
    routes: [{ path: '/', name: 'home', component: HomeView }],
  })
  ```
  HomeView 见 `VUE_COMPONENT_PATTERN`
- **MIRROR**: VUE_COMPONENT_PATTERN
- **IMPORTS**: `vue-router`, `pinia`
- **GOTCHA**: Electron 渲染进程**必须**用 `createWebHashHistory`（非 history 模式）；否则 `file://` 协议下深链会 404
- **VALIDATE**: 启动 `npm run dev` 看到首屏

### Task 9: `main.ts` 注册 Pinia + Router

- **ACTION**: 把 `pinia` 和 `router` 注入 Vue 实例
- **IMPLEMENT**:
  ```ts
  // src/renderer/src/main.ts
  import { createApp } from 'vue'
  import { createPinia } from 'pinia'
  import { router } from './router'
  import App from './App.vue'
  import './style.css'

  createApp(App).use(createPinia()).use(router).mount('#app')
  ```
- **MIRROR**: shamscorner/electron-vite-ts-stackter 的 main.ts
- **IMPORTS**: 上方代码即全部
- **GOTCHA**: `App.vue` 必须有 `<router-view />`（脚手架默认 `<RouterView />` 即可）
- **VALIDATE**: `npm run dev`

### Task 10: `.env.example` + `.gitignore` + `README.md`

- **ACTION**: 创建配置模板和文档
- **IMPLEMENT**:
  ```bash
  # .env.example
  COUCHDB_URL=https://couch.example.com/cc-remote
  COUCHDB_USER=replace_me
  COUCHDB_PASSWORD=replace_me
  ```
  ```
  # .gitignore（在脚手架生成基础上加）
  cc-remote-local/
  .env
  ```
  ```markdown
  # README.md（最小化）
  ## 开发启动
  1. 复制 `.env.example` 为 `.env` 并填入自建 CouchDB 凭据
  2. `npm install`
  3. `npm run dev`

  ## 当前阶段（Phase 1）
  - Electron 窗口启动后会自动 sync 到 `${COUCHDB_URL}` 指定的 CouchDB 实例
  - 首屏卡片实时显示 sync 状态
  - 任务/用户/项目相关功能在 Phase 2+ 加入

  ## 故障排查
  - `Module did not self-register` 或 `NODE_MODULE_VERSION` 报错 → 跑 `npx electron-rebuild`
  - sync 卡在 `connecting` → 检查 `COUCHDB_URL` 是否可访问、HTTPS 证书有效、CouchDB CORS 允许
  ```
- **MIRROR**: nuxt-target 项目的 README 风格（用户已熟悉）
- **IMPORTS**: N/A
- **GOTCHA**:
  - `.env`（带真实凭据）不能 commit；`.env.example` 必须 commit
  - 现有 `.gitignore` 由脚手架生成；只添加项，不要全文覆盖
- **VALIDATE**:
  ```bash
  test -f .env.example && grep -q COUCHDB_URL .env.example && echo "ok: example present"
  grep -q "cc-remote-local/" .gitignore && echo "ok: gitignore patched"
  ```

### Task 11: dev 启动 + 端到端 sanity check

- **ACTION**: 跑通整个链路
- **IMPLEMENT**:
  ```bash
  # 1. 配置 .env（用户自建 CouchDB 实际值）
  cp .env.example .env
  # 手动编辑 .env

  # 2. 启动
  npm run dev
  # 应当：Electron 窗口出现；首屏显示 "同步状态: connecting" → "active" / "paused"
  ```
- **MIRROR**: N/A（人工验证）
- **IMPORTS**: N/A
- **GOTCHA**:
  - 如果 sync 一直 `connecting` 不变 → 在主进程 console 检查是不是 401（凭据错）或 CORS（CouchDB 没开 cors）
  - CouchDB 默认未开 cors；自建实例需在 `local.ini` 加 `[chttpd] enable_cors = true` 和 `[cors] origins = *`（dev 阶段）
  - 主进程 PouchDB 不受 CORS 限制（Node fetch），但 Phase 6 的渲染进程/PWA 会受影响 —— 提前在用户的 CouchDB 上开好
- **VALIDATE**:
  - [ ] 窗口打开
  - [ ] 主进程 console 无未捕获错误
  - [ ] UI 上 `status.phase` 至少出现过 `active` 或 `paused`
  - [ ] 在 CouchDB 上确实能看到 `cc-remote` 库（`curl ${COUCHDB_URL}` 返回 200）

### Task 12: 写 1 条最小 vitest（仅做"可测性 sanity"）

- **ACTION**: 用 vitest（脚手架可能已带；如果没带，安装）
- **IMPLEMENT**:
  ```bash
  npm install -D vitest
  ```
  ```ts
  // src/main/db.test.ts —— 用 memory adapter 验证 SyncManager 不依赖真实 CouchDB
  ```
  完整代码见 `TEST_STRUCTURE` pattern；测试覆盖 `start()` 后第一条 status 必为 `connecting`
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { SyncManager } from './db'
  ```
- **GOTCHA**:
  - 用 PouchDB memory adapter (`pouchdb-adapter-memory`) 才能在测试里跑而不依赖磁盘；本阶段不引入，留 TODO
  - **本阶段不追求 80% 覆盖率**（PRD 验收无此要求）；只验证模块加载得起来 + 单元可测
- **VALIDATE**:
  ```bash
  npx vitest run src/main/db.test.ts
  ```

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| SyncManager.start() emits 'connecting' | new instance | first status.phase === 'connecting' | No |
| SyncManager.restart() cancels prev sync | start() then restart() | no error; emits 'connecting' again | No |

### Edge Cases Checklist

- [ ] `.env` 缺失（应使用 `http://localhost:5984/cc-remote` 默认值并打印 warning）
- [ ] `COUCHDB_URL` 不可达（应进入 `error` 状态而非崩溃）
- [ ] HTTPS 证书无效（CouchDB 自签证书 → 文档化方案：dev 设 `NODE_TLS_REJECT_UNAUTHORIZED=0` 或安装根证书）
- [ ] 用户改 `.env` 后重启 → sync 切到新地址
- [ ] 主进程 HMR 时 IPC handler 不重复注册（用 `ipcMain.removeHandler` 兜底或在退出时清理）

---

## Validation Commands

### Static Analysis

```bash
cd /d/Workspace/canger/claudecode-remote
npx vue-tsc --noEmit
```
EXPECT: 0 错误

```bash
npx tsc --noEmit -p tsconfig.node.json
```
EXPECT: 0 错误（main + preload）

### Lint

```bash
npm run lint
```
EXPECT: 0 错误（脚手架已配 ESLint）

### Unit Tests

```bash
npx vitest run
```
EXPECT: 至少 1 测试通过；无 fail

### Dev Server (Browser Validation)

```bash
npm run dev
```
EXPECT:
- Electron 窗口出现
- DevTools console 无 error
- 首屏显示 sync 状态卡片
- 状态从 `connecting` → `active` 或 `paused`（取决于是否有数据）

### CouchDB 连通性手测

```bash
# 用 .env 中的真实 URL（替换占位）
curl -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "${COUCHDB_URL}"
```
EXPECT: HTTP 200 + JSON 含 `db_name: "cc-remote"`（库存在）；首次跑可能 404 → app 启动会自动 PUT 创建

### Manual Validation

- [ ] `npm install` 无 fatal error（warning 可接受）
- [ ] `npm run dev` 出窗口 < 30s
- [ ] `.claude/` 目录在脚手架后**仍然存在且无变更**（敏感目录）
- [ ] PRD 状态从 `pending` 改为 `in-progress`，并填入本 plan 路径

---

## Acceptance Criteria

- [ ] Task 1-12 全部完成
- [ ] `npm run dev` 一次跑通，窗口出现 sync 状态
- [ ] `npx vue-tsc --noEmit` 0 错误
- [ ] `npx vitest run` 至少 1 测试通过
- [ ] `.env.example` 提交，`.env` 不提交
- [ ] PRD Phase 1 行的状态更新为 `in-progress` + Plan 链接

## Completion Checklist

- [ ] 代码遵循 NAMING_CONVENTION（camelCase 文件、PascalCase 组件）
- [ ] 错误显式 emit，不静默吞（POUCHDB_SYNC_PATTERN 中 `error` 事件已绑定）
- [ ] PouchDB 实例在主进程，**渲染进程通过 IPC 间接访问**（无 nodeIntegration）
- [ ] preload `contextBridge` 暴露的 API 是白名单，不暴露 `ipcRenderer` 全集
- [ ] 没有把 `ANTHROPIC_API_KEY` / `COUCHDB_PASSWORD` 写到任何 commit
- [ ] `.gitignore` 含 `cc-remote-local/`、`.env`
- [ ] README 含启动指南 + 故障排查
- [ ] 没有引入"任务"、"项目"、"用户" 文档 schema（Phase 2 边界守住）

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LevelDB 原生模块版本不匹配（apache/pouchdb#5496） | M | Crash on launch | `npx electron-rebuild`；文档化故障排查；备用方案换 memory adapter |
| 用户自建 CouchDB CORS 未开 → Phase 6 PWA 接不上 | H（届时） | Phase 6 阻塞 | 现在就在 README 写 CouchDB 配置要求；Phase 1 主进程不受 CORS 限制故先放一放 |
| electron-vite 脚手架覆盖 `.claude/` 目录 | L | PRD 丢失 | Task 1 用 tmp-scaffold + 手动合并；`git status` 验证 |
| Pinia HMR 时 sync listener 泄漏 | M | dev 内存膨胀 | `onScopeDispose` 已加，验证 store 销毁路径 |
| 自签 HTTPS CouchDB 证书拒连 | M | sync 永远 connecting | README 文档化 `NODE_TLS_REJECT_UNAUTHORIZED=0`（仅 dev）或装根证书 |
| 用户没在 CouchDB 上启用 `couch_peruser` | L（本阶段） | Phase 2 推进时再处理 | Phase 1 暂用单库；Phase 2 plan 重申该前置条件 |

## Notes

- **架构决策追溯**：本 plan 遵循 PRD Decisions Log 第 256-264 行所有决策，未引入额外决策
- **Phase 边界**：用户在 askUserQuestion 中确认 Phase 1 扩展到包含 PouchDB 实例化 + IPC 桥；本 plan 严格在此边界内，不下沉到 schema/auth（Phase 2）
- **下一步衔接**：Phase 2 在本 plan 落地基础上加 ① 用户登录 ② DPU 切库 ③ task/project/user schema；本阶段把 SyncManager 的 `localPath` 和 `remoteUrl` 设计为构造函数参数即为 Phase 2 切库做了准备
- **本地路径**：bash on Windows，`mv` 等命令本机可用；TS 路径用 `/`，shell 路径用 `D:/...` 或 `/d/...`
- **更新 PRD**：本 plan 完成后，需把 PRD `Phase 1` 行的 Status 改为 `in-progress`，PRP Plan 列填入本文件路径
