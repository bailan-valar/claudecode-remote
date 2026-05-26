# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供针对本仓库代码的工作指引。

## 项目概述

ClaudeCode Remote 是一款用于管理 AI 驱动开发任务的 Electron 桌面客户端。它使用 PouchDB 进行本地数据存储，并与 CouchDB 同步，同时集成 Claude Code CLI 执行任务。

**技术栈：** Electron + Vue 3 + TypeScript + PouchDB + Pinia

## 开发命令

```bash
# 开发（支持热更新）
npm run dev          # 主开发服务（renderer 端口 3456，API 端口 3457）
npm run dev:hmr      # HMR 开发模式（API 端口 8543）

# 构建
npm run build        # 类型检查 + electron-vite 构建
npm run build:win    # 构建 Windows 安装包
npm run build:mac    # 构建 macOS 安装包
npm run build:linux # 构建 Linux 安装包

# 代码质量
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 自动修复
npm run format       # Prettier 格式化

# 测试
npm run test         # 运行测试（vitest）
```

> **Agent 限制：**
> - 不要自动运行任何 `npm run` 构建脚本（如 `npm run build`、`npm run build:win` 等）。
> - 不要自动启动开发服务器（如 `npm run dev`、`npm run dev:hmr`）。
> - 以上命令仅在用户明确要求时，才手动执行。

## 环境配置

复制 `.env.example` 为 `.env` 并进行配置：

```bash
# CouchDB 连接
COUCHDB_URL=http://localhost:5984/cc-remote
COUCHDB_USER=your_username
COUCHDB_PASSWORD=your_password
COUCHDB_ADMIN_USER=admin    # 可选，用于创建用户数据库
COUCHDB_ADMIN_PASSWORD=     # 可选

# Web 服务端口（用于移动端访问）
WEB_PORT=3457
```

CouchDB 必须启用 CORS（在 `local.ini` 中设置 `enable_cors = true`）。

## 架构

### 进程结构

- **主进程** (`src/main/`): Node.js 后端，数据库，任务引擎
- **渲染进程** (`src/renderer/`): Vue 3 前端 UI
- **预加载** (`src/preload/`): 安全 IPC 的上下文桥接
- **共享** (`src/shared/`): 主进程与渲染进程共享的 TypeScript 类型

### 关键目录

```
src/
├── main/
│   ├── index.ts           # 应用入口，窗口创建
│   ├── ipc.ts             # IPC 处理器注册
│   ├── apiActions.ts      # IPC 处理器的业务逻辑
│   ├── db.ts              # PouchDB <-> CouchDB 同步管理器
│   ├── configStore.ts     # 应用配置持久化
│   ├── webServer.ts       # 移动端 Web 访问的 Express 服务器
│   ├── engine/
│   │   ├── taskEngine.ts  # 任务执行队列管理器
│   │   ├── runner.ts      # 任务运行器接口
│   │   ├── claudeRunner.ts # Claude Code CLI 集成
│   │   └── runnerRegistry.ts # 运行器工厂
│   └── repositories/      # PouchDB 数据访问层
│       ├── baseRepository.ts
│       ├── taskRepository.ts
│       └── projectRepository.ts
├── renderer/
│   └── src/
│       ├── api/index.ts   # API 客户端（IPC + HTTP 回退）
│       ├── stores/        # Pinia 状态管理
│       ├── views/         # Vue 页面组件
│       └── components/    # Vue 可复用组件
└── shared/
    ├── types.ts           # 共享的 TypeScript 接口
    └── constants.ts       # 共享常量
```

### 数据流

1. **渲染进程 → 主进程:** 通过 `window.api` (IPC) 或 HTTP (`/api/*`) 调用 API
2. **主进程:** `apiActions.ts` 处理业务逻辑
3. **仓储层:** PouchDB CRUD 操作，支持乐观锁
4. **事件:** `mainEvents` EventEmitter 向渲染进程广播变更
5. **渲染进程:** Pinia 状态通过 SSE 事件 (Web) 或 IPC 事件 (桌面端) 更新

### 任务执行流程

1. 任务以状态 `pending` 或 `plan_required` 创建
2. TaskEngine 监听 PouchDB changes feed 以发现待处理任务
3. 检测到后，引擎将任务加入队列（支持项目级串行 + 全局并发控制）
4. 运行器 (Claude Code CLI) 在项目目录中执行任务
5. 状态更新: `pending` → `developing` → `reviewing` → `completed`
6. 完成/失败时发送 Webhook 通知（企业微信）

### 仓储模式

所有数据库访问均通过 `src/main/repositories/` 中的仓储类进行：

```typescript
// BaseRepository 提供: findAll, findById, create, update, delete
// 内置冲突重试机制（通过 _rev 实现乐观锁）

const taskRepo = createTaskRepository(db)
const task = await taskRepo.findById(taskId)
await taskRepo.update(taskId, { status: 'completed' })
```

文档 ID 使用带前缀的 UUID: `task:{uuid}`, `project:{uuid}`.

### IPC 通信

桌面端使用 `ipcRenderer.invoke()` 发送请求，`ipcRenderer.on()` 接收事件。

所有 IPC 处理器在 `src/main/ipc.ts` 中注册。新增处理器时：
1. 在 `ipc.ts` 中使用 `ipcMain.handle()` 添加处理器
2. 在 `src/preload/index.ts` 中添加对应方法
3. 在 preload 的 `Api` 类型中添加 TypeScript 类型声明

### 双模式 API 客户端

渲染进程的 API 客户端 (`src/renderer/src/api/index.ts`) 支持两种模式：
- **Electron:** 使用 `window.api` (preload 提供的 IPC 桥接)
- **Web:** 使用 HTTP fetch + SSE 接收事件 (移动端访问)

这使得相同的 UI 既能在桌面应用中运行，也能在移动浏览器中运行。

## 任务引擎

TaskEngine (`src/main/engine/taskEngine.ts`) 管理异步任务执行：

- **项目级串行:** 同一项目中的任务按顺序执行
- **全局并发:** 多个项目可并行运行（可配置）
- **运行器:** 可插拔的执行引擎（当前为 Claude Code CLI）
- **状态持久化:** 引擎状态在重启后保留
- **中止处理:** 任务可在执行过程中停止

## 添加功能

### 新增数据库实体

1. 在 `src/shared/types.ts` 中添加类型
2. 在 `src/main/repositories/` 中创建仓储
3. 在 `src/main/apiActions.ts` 中添加 CRUD 操作
4. 在 `src/main/ipc.ts` 中添加 IPC 处理器
5. 在 `src/preload/index.ts` 中暴露接口
6. 在 `src/renderer/src/api/index.ts` 中添加 API 客户端方法

### 新增任务运行器

1. 在 `src/main/engine/` 中实现 `TaskRunner` 接口
2. 在 `src/main/engine/runnerRegistry.ts` 中注册
3. 更新 `src/shared/constants.ts` 中的 `ENGINE_PROVIDER` 常量

## 测试

测试位于 `src/main/**/__tests__/` 和 `src/renderer/**/__tests__/`。

使用 `npm run test` (vitest) 运行。

## 构建配置

- **electron-vite.config.ts:** 主进程/预加载/渲染进程的 Vite 配置
- **tsconfig.json:** 项目引用（node + web）
- **package.json:** Electron builder 安装包配置

构建使用 `electron-vite`，打包：
- Main: Node.js 目标（无浏览器 polyfill）
- Preload: 隔离上下文
- Renderer: Vue 3 SPA，Vite 开发服务器
