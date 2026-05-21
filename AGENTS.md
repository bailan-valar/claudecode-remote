# ClaudeCode Remote

ClaudeCode 多项目桌面客户端，基于 Electron + Vue 3 + PouchDB。

用于管理多个项目的 Claude Code 任务，支持本地 PouchDB 与远程 CouchDB 双向同步，并内置任务引擎自动消费待执行任务。

---

## 技术栈

- **桌面框架**: Electron 35 + electron-vite 3
- **前端**: Vue 3.5 (Composition API + `<script setup>`) + Vue Router 4 + Pinia 3
- **构建工具**: Vite 6 (由 electron-vite 封装)
- **数据库**: PouchDB 9 (本地 LevelDB) + CouchDB (远程同步)
- **认证**: pouchdb-authentication
- **任务队列**: p-queue
- **语言**: TypeScript 5.8 (严格模式)
- **测试**: Vitest 3
- **代码规范**: ESLint 9 (含 eslint-plugin-vue) + Prettier 3

---

## 项目结构

```
src/
├── main/              # Electron 主进程 (Node.js)
│   ├── index.ts       # 应用入口：创建窗口、初始化 SyncManager / AuthManager / TaskEngine
│   ├── db.ts          # SyncManager：PouchDB 本地库 + CouchDB 远程同步
│   ├── auth.ts        # AuthManager：基于 pouchdb-authentication 的注册/登录/会话
│   ├── ipc.ts         # IPC 处理器：所有主进程暴露给渲染进程的 API 实现
│   ├── engine/        # 任务引擎
│   │   ├── taskEngine.ts    # TaskEngine：监听 changes feed，自动消费 pending 任务
│   │   └── claudeRunner.ts  # runClaudeTask：spawn `claude` CLI 子进程，解析 stream-json 输出
│   └── repositories/  # 数据访问层
│       ├── baseRepository.ts
│       ├── projectRepository.ts
│       └── taskRepository.ts
├── preload/           # Electron preload 脚本
│   └── index.ts       # 通过 contextBridge 暴露 window.api，定义所有 IPC 调用接口
├── renderer/          # Vue 3 前端
│   ├── src/
│   │   ├── main.ts         # 渲染进程入口
│   │   ├── App.vue         # 根组件：侧边栏导航 + 响应式移动端适配
│   │   ├── style.css       # 全局 Liquid Glass 设计系统
│   │   ├── router/         # Vue Router (hash 模式)
│   │   ├── stores/         # Pinia 状态管理 (useAuthStore / useProjectStore / useTaskStore / useSyncStore / useEngineStore)
│   │   ├── views/          # 页面级组件
│   │   ├── components/     # 可复用组件
│   │   ├── types/api.d.ts  # Window.api 全局类型声明
│   │   └── utils/          # 工具函数 + 单元测试
│   └── index.html
└── shared/            # 主进程与渲染进程共享
    ├── types.ts       # Project / Task / User / BaseDoc 类型定义
    └── constants.ts   # DOC_TYPE / TASK_STATUS / TASK_PRIORITY 常量
```

输出目录为 `out/`，分为 `out/main/`、`out/preload/`、`out/renderer/`。

---

## 构建与运行命令

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 类型检查
npm run typecheck          # 同时检查 Node / Web 两端
npm run typecheck:node     # 仅主进程 + preload
npm run typecheck:web      # 仅渲染进程

# 生产构建
npm run build              # 先 typecheck，再 electron-vite build

# 代码规范
npm run lint               # ESLint 自动修复
npm run format             # Prettier 格式化全部文件

# 测试
npx vitest                 # 运行测试（项目未配置 vitest.config，使用默认配置）

# 打包
npm run build:unpack       # 打包为目录（不解包）
npm run build:win          # Windows 安装包
npm run build:mac          # macOS DMG
npm run build:linux        # Linux AppImage / snap / deb
```

---

## 配置说明

### 环境变量

复制 `.env.example` 为 `.env`：

```bash
# CouchDB 连接（可带库名，程序会自动提取 base URL）
COUCHDB_URL=http://localhost:5984/cc-remote
COUCHDB_USER=replace_me
COUCHDB_PASSWORD=replace_me

# CouchDB Admin（用于创建用户 DB；如已启用 couch_peruser 可留空）
COUCHDB_ADMIN_USER=admin
COUCHDB_ADMIN_PASSWORD=replace_me
```

**注意**：`COUCHDB_URL` 中的路径（如 `/cc-remote`）**不会被直接使用**；程序会截取 base URL，实际用户数据库名由 `pouchdb-authentication` 的 `getUserDbName(username)` 生成（格式为 `userdb-<hex>`）。

### CouchDB 必要配置

开发阶段需在 CouchDB 的 `local.ini` 启用 CORS：

```ini
[chttpd]
enable_cors = true

[cors]
origins = *
```

---

## 运行时架构

### 1. 主进程 (`src/main/`)

- **窗口管理** (`index.ts`)：创建 900×670 的 BrowserWindow，开发期加载 Vite dev server，生产期加载本地 HTML。
- **数据库同步** (`db.ts`)：`SyncManager` 负责：
  - 为每个用户创建独立的本地 PouchDB（命名：`cc-remote-<username>`）
  - 与远程 CouchDB 建立 live + retry 双向同步
  - 通过 EventEmitter 向渲染进程广播 sync 状态（idle / connecting / active / paused / error）
- **认证** (`auth.ts`)：`AuthManager` 封装 pouchdb-authentication 的 signUp / logIn / logOut / getSession。
- **IPC 层** (`ipc.ts`)：所有跨进程通信的枢纽。包含：
  - Sync 控制：`sync:refresh`
  - Auth：`auth:register`, `auth:login`, `auth:logout`, `auth:session`
  - Project CRUD：`project:list/create/update/delete`
  - Task CRUD：`task:list/create/update/delete`
  - Engine 控制：`engine:start/stop/pause/resume/setConcurrency/status`
  - 系统对话框：`dialog:openDirectory`

### 2. 任务引擎 (`src/main/engine/`)

- **`TaskEngine`** (`taskEngine.ts`)：
  - 依赖本地 PouchDB 的 `changes({ live: true })` 监听新任务
  - 自动将 `status === 'pending'` 的任务加入执行队列
  - 使用 `p-queue` 控制全局并发（默认可调 1–5）
  - **项目级串行**：同一项目的任务按顺序执行（通过 `projectLocks`），不同项目可并发
  - 任务启动时状态变为 `developing`，成功→`reviewing`，失败→回到 `pending` 并记录 `reviewFeedback`
  - 日志采用 throttle + flush 机制（2 秒批量写入），减少 PouchDB 冲突
  - 支持 AbortController 取消正在运行的任务

- **`runClaudeTask`** (`claudeRunner.ts`)：
  - spawn `claude` 子进程，参数固定为：`-p --output-format stream-json --bare --allowedTools ... --verbose`
  - 若任务带有 `claudeSessionId`（或父任务有），追加 `--resume <sessionId>` 保持上下文
  - 从 stdout 解析 NDJSON：提取 `type: system` 的 `session_id`、`type: assistant` 的 tool_use、以及最终结果
  - 通过 `onLog` 回调将实时日志回传引擎，最终写入 Task 文档的 `logs` 字段
  - 项目级 LLM 配置（`project.llmConfig`）通过环境变量 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` 注入

### 3. 渲染进程 (`src/renderer/`)

- **路由**：Hash 模式，受 `useAuthStore` 的登录状态守卫。
  - `/login` — 登录/注册（公开）
  - `/` — 首页（同步状态 + 引擎状态 + 统计卡片）
  - `/projects` — 项目列表
  - `/projects/:id` — 项目详情
  - `/tasks` — 任务列表
  - `/tasks/:id` — 任务详情
- **状态管理**：所有 Store 均使用 Pinia + Composition API (`defineStore(..., () => {...})`)：
  - `useAuthStore` — 登录/注册/注销/会话检查
  - `useProjectStore` — 项目 CRUD 缓存
  - `useTaskStore` — 任务 CRUD 缓存 + 按项目过滤 + 状态统计
  - `useSyncStore` — 监听 `sync:status` 推送
  - `useEngineStore` — 引擎启停/暂停/恢复/并发控制，监听 `engine:status` / `engine:task:completed` / `engine:task:failed`
- **UI 风格**：全局使用 Liquid Glass（毛玻璃）设计系统，定义在 `style.css`。主要工具类：`.glass`, `.glass-strong`, `.glass-button`, `.glass-input`。
- **移动端适配**：`App.vue` 内置 `window.innerWidth < 768` 检测，小屏切换为底部固定导航栏。

### 4. Preload (`src/preload/`)

- 严格使用 `contextBridge.exposeInMainWorld('api', api)` 暴露接口。
- 所有 IPC 调用均通过 `ipcRenderer.invoke` / `ipcRenderer.on` / `ipcRenderer.off` 封装，并返回 unsubscribe 函数。
- 类型声明在 `src/renderer/src/types/api.d.ts`，全局扩展 `Window.api`。

---

## 数据模型

所有文档存储在 PouchDB / CouchDB 中，共享 `BaseDoc`：

```ts
interface BaseDoc {
  _id: string
  _rev: string
  type: string
}
```

### Project

- `_id` 格式：`project:<uuid>`
- 字段：`name`, `path`（本地绝对路径）, `description`, `llmConfig`（provider / baseUrl / apiKey / model）, `allowedTools`, `createdAt`, `updatedAt`

### Task

- `_id` 格式：`task:<uuid>`
- 字段：`projectId`, `parentTaskId`, `title`, `description`, `prompt`, `status`, `priority`, `claudeSessionId`, `logs[]`, `createdAt`, `updatedAt`, `completedAt`, `createdVia`（`'desktop'` 或 `'mobile'`）, `reviewFeedback`

### 任务状态流转

```
planned → pending → developing → reviewing → completed
                                   ↘ closed
```

只允许单向或指定回退：
- `reviewing` 可回退到 `pending`（审核不通过重试）或关闭 `closed`。
- 引擎只自动消费 `pending` 状态的任务。

---

## 代码风格规范

- **语言**：TypeScript 严格模式。注释和 UI 文案以**中文**为主。
- **Vue**：单文件组件使用 `<script setup lang="ts">` + scoped CSS。
- **样式**：
  - 全局变量在 `style.css` 的 `:root` 中定义。
  - 使用 Liquid Glass 工具类（`.glass`, `.glass-button`, `.glass-input` 等），避免在每个组件重复写 `backdrop-filter`。
- **IPC 命名约定**：`domain:action`，例如 `project:create`、`task:update`、`engine:status`。
- **Repository 模式**：`BaseRepository` 封装 PouchDB 的 `allDocs`/`get`/`put`，子 repository 通过工厂函数导出。
- **错误处理**：主进程 IPC handler 统一 `try/catch`，返回 `{ ok: boolean, error?: string }` 结构；日志输出使用 `console.error('[domain] message:', err.message)`。

---

## 测试策略

测试框架为 **Vitest**，当前覆盖范围较小：

| 测试文件 | 说明 |
|---------|------|
| `src/main/repositories/__tests__/baseRepository.test.ts` | BaseRepository CRUD 测试，使用 `pouchdb-adapter-memory` |
| `src/renderer/src/utils/__tests__/taskTransitions.test.ts` | 任务状态流转规则测试 |

运行命令：

```bash
npx vitest
```

**注意**：项目目前没有 `vitest.config.ts`，使用 Vitest 默认配置即可。如需添加 renderer 端组件测试，建议配置 `@vue/test-utils`。

---

## 部署与打包

- 使用 `electron-builder` 打包，配置在 `electron-builder.yml`。
- `asarUnpack` 包含 `resources/**`，如有外部二进制资源可放入该目录。
- 平台目标：
  - Windows：`nsis` 安装包
  - macOS：`dmg`（未开启 notarize）
  - Linux：`AppImage`, `snap`, `deb`
- 自动更新目前配置为占位地址 (`https://example.com/auto-updates`)，正式使用前需替换。

---

## 安全注意事项

1. **Preload 安全**：已开启 `contextIsolation: true`，所有 Node API 通过显式封装的 `window.api` 暴露，`sandbox: false` 仅因部分原生模块需求而关闭，避免在 preload 中暴露无关接口。
2. **数据库凭证**：`.env` 中的 CouchDB 密码会被打包进应用（通过 `dotenv/config` 在 main 进程加载）。生产环境应使用更安全的凭证分发方式，避免将管理员密码暴露给客户端。
3. **本地项目路径**：任务引擎以子进程方式在 `project.path` 目录执行 `claude` CLI，需确保该路径可信，避免路径遍历或命令注入。
4. **LLM API Key**：项目的 `llmConfig.apiKey` 以明文形式存储在 PouchDB 文档中，同步到 CouchDB 时也会保存在远程。当前实现未做加密处理。

---

## 故障排查

| 现象 | 解决方案 |
|------|---------|
| `Module did not self-register` / `NODE_MODULE_VERSION` 报错 | 运行 `npx electron-rebuild` |
| sync 卡在 `connecting` | 检查 `COUCHDB_URL` 是否可访问、HTTPS 证书有效、CouchDB CORS 是否启用 |
| 子进程无法找到 `claude` 命令 | 确保系统 PATH 包含 Claude Code CLI 的可执行文件 |
