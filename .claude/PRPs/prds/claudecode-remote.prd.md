# ClaudeCode Remote —— 多项目 Claude Code 任务编排桌面应用

## Problem Statement

Claude Code 开发者在并行推进多个项目时，**任务管理与 Claude Code 执行是割裂的两张皮**：开发者必须人工守在终端里逐条对话，等一个项目跑完才能切下一个；当突然冒出需求灵感或线上 bug 时，没有手机端入口可以即时投递任务。结果是开发者被困在"调度员"角色，而不是"产品负责人 + 测试员"。

## Evidence

- 用户自述：作为多项目并行 Claude Code 开发者，"任务多的情况下需要等 Claude Code 回复之后再执行下一个"
- 用户自述：存在"手机端新增任务"场景但当前不支持
- 市场扫描：2026 年涌现的 [Vibe Kanban](https://vibekanban.com/)、[Kangentic](https://kangentic.com/)、[Cline Kanban](https://cline.bot/kanban) 等产品验证了"AI 编码 Agent + 任务编排"的真实需求 —— 但这些产品都把任务管理做成 Kanban 拖拽，且**没有强制的人工审核环节**
- 假设（待验证）：国内 Claude Code 开发者因为网络与模型可用性，需要 **多 LLM 后端切换**（如 智谱 GLM、Kimi K2 提供的 Claude 兼容端点）—— 这是 Anthropic 官方桌面 App + Routines + Remote Control 的盲区

## Proposed Solution

构建一款 **Electron 桌面应用 + PWA 移动端**，以 **任务/子任务 + 五状态流转**（计划中 → 待开发 → 开发中 → 待审核 → 已完成 / 已关闭）为骨架，内置 **任务引擎** 按用户配置的并发数自动消费"待开发"队列，调用 Claude Code（或兼容端点的智谱、Kimi）逐一完成任务并回写为"待审核"。用户只剩两个动作：**录入任务**（手机或桌面）+ **测试验收**（桌面）。

之所以选这条路而非 Kanban 拖拽（Vibe Kanban）或官方并行会话（Anthropic Workspace），是因为我们押注两个差异点：**强制人工审核卡点**（杜绝 AI 直接 done）+ **任务队列心智**（一次配，自动消费，不用拖卡片）。

## Key Hypothesis

我们相信 **「任务队列 + 强制人工审核 + Claude Code 自动消费」** 会让 **Claude Code 开发者** 实现 **「只关注录入需求和测试验收，不再值守对话"**。
我们将通过 **「单用户单日可推进的任务数 ≥ 5（vs. 当前手动模式 ≤ 2）」** 来验证。

## What We're NOT Building

- **不是 Kanban 看板** —— 不做拖拽列、燃尽图、多视图切换；状态流转通过状态机自动+审核按钮触发
- **不是团队协作工具** —— v1 不做评论、@提及、权限角色、共享项目（多用户仅做数据隔离）
- **不是 Cursor / VS Code 插件** —— 不嵌入 IDE，独立桌面 App
- **不是 Agent 不可知工具** —— 不集成 Cursor Agent / GitHub Copilot 等；只对接 Claude Code 协议（兼容智谱/Kimi 端点）
- **不是 PR/Git 工作流自动化** —— v1 不做自动 commit / PR 创建 / 分支管理 / git worktree 隔离
- **不是计费/账单系统** —— v1 不显示 token 成本、不做配额管理
- **不服务于不使用 Claude Code 的人** —— 这是 Claude Code 专精工具

## Success Metrics

| 指标 | 目标 | 测量方式 |
|--------|--------|--------------|
| 单用户单日推进任务数 | ≥ 5（vs. 手动 ≤ 2） | 应用内任务进入"已完成/已关闭"的次数 / 日 |
| 任务从"待开发"到"待审核"耗时 | P50 < 30 分钟 | 引擎日志的 status_change 时间戳差 |
| 手机端创建任务占比 | ≥ 30% | 任务文档的 `created_via` 字段聚合 |
| 并发数实际利用率 | 配置 N → 实际 ≥ 0.7N 任务并发 | 引擎运行时统计 |
| 审核通过率（Claude 一次过） | ≥ 60% | "待审核 → 已完成" / "待审核 → 退回 待开发" 比 |

## Open Questions

- [ ] **CouchDB 部署形态**：用户自己起 CouchDB，还是 App 内嵌（如 [PouchDB Server](https://github.com/pouchdb/pouchdb-server)）？或用 IBM Cloudant 托管？影响安装门槛。
- [ ] **审批策略**：Claude Code 执行时遇到危险操作（写文件、删除等），是否一律 `--dangerously-skip-permissions`？还是允许用户配置每个项目的工具白名单？
- [ ] **任务失败处理**：Claude Code 跑失败（exit≠0、超 turn 上限、超预算）后，任务回到"待开发"还是进新状态"失败"？
- [ ] **同项目任务并发冲突**：两个任务同时在同一个项目目录跑，文件冲突怎么办？是按项目串行 + 跨项目并行？还是用 git worktree 隔离？
- [ ] **会话生命周期**：父任务的 Claude Code session_id 要保留多久？子任务可能在父任务完成数天后才创建，session 是否还可 `--resume`？
- [x] ~~**3 天 MVP 真实可行性**~~ —— **已决策（2026-05-06）**：接受时间延长。MVP（Phase 1-7）目标 **5-7 天**；完整版（Phase 1-11）目标 **2-3 周**
- [ ] **多 LLM 兼容性细节**：智谱 GLM / Kimi K2 的 Claude 兼容端点能否完整支持 Claude Code 的工具调用 / 系统提示 / 长上下文？需要做兼容性 spike

---

## Users & Context

**Primary User**

- **Who**：使用 Claude Code 进行多项目开发的独立开发者或小团队成员（包括产品负责人本人）
- **当前行为**：在多个 IDE 窗口或 tmux 中并行守着 Claude Code 终端会话，需要在不同项目间手动切换，回家路上想到 bug 也只能记在备忘录里
- **触发时刻**：(a) 灵感/bug 来袭时（任何时间、任何地点）；(b) 一批功能开发完准备测试时；(c) 想趁咖啡时间让 Claude 多干一会儿活
- **成功状态**：早上录入 5 个任务 → 中午看到 4 个进入"待审核" → 测试通过 3 个/退回 1 个 → 下午继续录新任务

**Job to Be Done**

- 当我**有需求灵感或发现 bug**（不论坐在电脑前还是在通勤）时，我想**直接在手机或电脑上录入一条任务**，这样我就能**不丢失想法、不打断手头工作**。
- 当我**有空闲且具备测试条件**时，我想**集中处理"待审核"队列**，这样我就能**用最少的上下文切换完成验收**。

**Non-Users**

- 不使用 Claude Code 的开发者（v1 不做 Cursor / Codex / Cline 等）
- 团队协作场景（v1 仅做单用户数据隔离，不做共享项目和评论）

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 任务/子任务 CRUD（桌面 + 移动端）| 核心数据骨架，没它什么都没有 |
| Must | 五状态流转（计划中 → 待开发 → 开发中 → 待审核 → 已完成/已关闭）| 产品差异化点，强制人工审核 |
| Must | 任务引擎：从"待开发"队列按并发数消费，调用 Claude Code | 自动消费是产品核心承诺 |
| Must | 子任务会话继承（继承父任务的 Claude Code session_id，未绑定则新建）| 用户明确强需求，影响数据模型 |
| Must | Claude Code 进度日志查看 | 审核环节必备的可观测性 |
| Must | 多 LLM 切换（Anthropic / 智谱 GLM / Kimi K2 配置切换）| 国内可用性差异化点 |
| Must | 多用户数据隔离（CouchDB Database-Per-User 模式）| 用户明确要求 |
| Must | 多项目支持（同一用户可绑定多个项目目录）| 用户明确要求 |
| Should | PWA 离线优先（手机端可在无网络时录入，恢复时自动同步）| PouchDB+CouchDB 天然能力，少做不浪费 |
| Should | 桌面端实时反馈引擎状态（运行中任务数、剩余队列长度）| 信任感 |
| Could | 任务失败重试策略 | 提升体验但 v1 可手动操作 |
| Could | 项目级工具白名单配置 | 安全感但 v1 可全开 |
| Won't | Kanban 拖拽视图 | 与产品心智冲突 |
| Won't | 自动 commit / PR / 分支管理 | 复杂度爆炸，v2 再考虑 |
| Won't | Token 成本展示与配额 | v1 不强需 |
| Won't | 团队协作（评论、@、共享项目、角色权限）| 明确出范围 |
| Won't | 集成 Cursor / Codex / GitHub Copilot 等非 Claude 协议 Agent | 明确专精 Claude Code |

### MVP Scope（最小验证范围）

**进 MVP 的能力（按优先级）：**
1. 任务 CRUD（桌面端） + 五状态流转
2. 任务引擎（单并发起步，能跑 `claude -p` 子进程，捕获 JSON 输出）
3. CouchDB 多用户认证 + Database-Per-User 数据隔离
4. 多项目目录绑定（任务可指定执行目录）
5. 移动端 PWA（仅 Create + List + 状态查看，不做完整编辑）
6. 多 LLM 配置切换（仅环境变量层 base URL/API key 切换，UI 给三个预设：Anthropic / 智谱 / Kimi）

**Phase 1 后续扩展（不入 MVP）：**
- 子任务会话继承（依赖父任务 session 持久化机制）
- 移动端完整 CRUD（编辑/删除）
- 进度日志详细查看（先简单展示最后一段输出）
- 并发数 > 1 的稳定性

> ✅ **时间线（2026-05-06 决策）**：用户接受时间延长。**MVP（上述 6 项）目标 5-7 天**；完整版（含子任务会话继承、移动端 CRUD、多并发、日志详情）目标 **2-3 周**。原始 3 天目标已弃用。

### User Flow

**关键路径（最短价值通路）：**

1. 用户在桌面 App 创建项目，绑定本地代码目录
2. 用户在桌面 / 手机录入任务，标题 + 描述（指定项目）
3. 任务自动进入 `计划中` → 用户标记为 `待开发`（或创建时直接选）
4. 任务引擎从队列拉一个任务，启动 `claude -p` 子进程（项目目录为 cwd）
5. Claude Code 跑完 → 任务变为 `待审核`，桌面显示通知 + 输出摘要
6. 用户人工测试该项目的功能 → 标记 `已完成` 或退回 `待开发`（带反馈）

---

## Technical Approach

**Feasibility**: HIGH ⭐

**Architecture Notes**

- **桌面**：Electron（主进程跑任务引擎、PouchDB Node 实例；渲染进程跑 React/Vue UI）
- **移动**：PWA（IndexedDB 适配器的 PouchDB，与 CouchDB 双向同步）
- **数据**：CouchDB（自带认证 + Database-Per-User）作为同步枢纽；客户端用 PouchDB 离线优先
- **任务引擎**：Node.js [`p-queue`](https://www.npmjs.com/package/p-queue) 控制并发；每个任务 `child_process.spawn('claude', ['-p', '--output-format', 'stream-json', '--bare', ...])`，cwd 设为项目目录
- **会话延续**：从首次执行 JSON 输出捕获 `session_id`，写入任务文档；子任务执行时 `--resume <session_id>`
- **多 LLM**：配置项 `{ provider: 'anthropic' | 'zhipu' | 'kimi', baseUrl, apiKey, model }`，通过环境变量 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` 注入子进程
- **同步触发**：CouchDB 端的 `_changes` feed 推送到桌面 PouchDB → 改变事件触发引擎重新拉队列

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 智谱/Kimi Claude 兼容端点对工具调用支持不全 | M | MVP 前做 1 天兼容性 spike，跑通 `claude -p "echo hello"` 与一次工具调用 |
| 同项目两个任务并发污染文件系统 | H | MVP 先做"项目级串行+跨项目并行"（每个项目一个独立队列） |
| Electron 主进程崩溃丢失运行中任务 | M | 任务状态在 PouchDB 持久化；启动时扫描"开发中"任务做恢复决策（手动确认） |
| `--dangerously-skip-permissions` 误删用户文件 | H | 提供项目级白名单 + 启动时引导用户读 `CLAUDE.md` 安全规范 |
| 移动端 PWA 在 iOS Safari 同步限制 | M | 文档化已知限制；提供桌面端兜底；后续考虑原生壳 |
| CouchDB 部署门槛劝退用户 | M | 提供 Docker 一键启动脚本 + 默认端口；后续考虑 App 内嵌 PouchDB Server |
| 3 天 MVP 范围估算偏差 | H | PRD 已经把范围分成 MVP（5-7 天）和扩展（2-3 周），分阶段验证 |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | 基础脚手架 | Electron + 主/渲染进程 + Vite + 基础路由 + 主进程 PouchDB 实例化（用户自建 CouchDB） | in-progress | - | - | [phase-1-scaffold-and-pouchdb.plan.md](../plans/phase-1-scaffold-and-pouchdb.plan.md) |
| 2 | 数据层 | CouchDB 认证 + DPU 模式 + PouchDB 同步 + 数据模型（用户/项目/任务） | pending | - | 1 | - |
| 3 | 桌面 CRUD UI | 任务列表 + 创建/编辑 + 状态流转按钮 + 项目管理 | pending | with 4 | 2 | - |
| 4 | 任务引擎 v1（单并发） | p-queue + spawn `claude -p` + 状态写回 + 错误处理 | pending | with 3 | 2 | - |
| 5 | 多 LLM 切换 | 配置 UI + 环境变量注入 + Anthropic/智谱/Kimi 预设 | pending | with 6 | 4 | - |
| 6 | 移动端 PWA（最小） | PouchDB IndexedDB + 任务列表 + 创建 + 同步 | pending | with 5 | 2, 3 | - |
| 7 | 兼容性 spike（智谱/Kimi） | 跑通 `claude -p` 在两个国产端点的工具调用 | pending | - | 1 | - |
| 8 | 子任务会话继承 | session_id 持久化 + `--resume` 调用 + 子任务父子关系 | pending | with 9 | 4 | - |
| 9 | 进度日志 | stream-json 解析 + 任务详情页日志展示 | pending | with 8 | 4 | - |
| 10 | 多并发 + 项目级串行 | 项目维度的子队列 + 跨项目并行 + 并发数配置 UI | pending | - | 4, 8 | - |
| 11 | 移动端 CRUD 完整版 | 编辑/删除/审核操作 | pending | - | 6 | - |

### Phase Details

**Phase 1: 基础脚手架**
- **Goal**: 跑得起来的 Electron 空壳 + 本地 CouchDB
- **Scope**: `npm init` Electron + Vite + React/Vue；docker-compose 起 CouchDB（端口/管理员预设）；空白主窗口能加载渲染进程
- **Success signal**: `npm run dev` 出现窗口，能 ping CouchDB 5984

**Phase 2: 数据层**
- **Goal**: 用户登录 + 多用户隔离的本地 + 远端数据同步
- **Scope**: CouchDB `_users` DB 注册/登录；DPU 创建（每用户独立 DB）；定义 `project` / `task` doc schema；PouchDB 主进程实例 + 实时 sync
- **Success signal**: 创建 2 个用户，各自看不到对方的任务

**Phase 3: 桌面 CRUD UI**
- **Goal**: 全键鼠操作完成任务管理
- **Scope**: 任务列表（按项目/状态过滤）+ 创建/编辑表单 + 状态流转按钮（待开发→[引擎托管]→待审核→已完成/退回/已关闭）+ 项目管理页
- **Success signal**: 不写代码也能完整操作一个完整任务生命周期

**Phase 4: 任务引擎 v1（单并发）**
- **Goal**: 引擎能自动消费"待开发"队列
- **Scope**: 主进程订阅 PouchDB `_changes`；任务进"待开发"自动入队；`p-queue({ concurrency: 1 })`；`spawn('claude', ['-p', '--output-format', 'stream-json', '--bare', '--allowedTools', 'Read,Edit,Bash', task.prompt], { cwd: project.path })`；捕获 stdout 解析最后一条 result，回写"待审核"
- **Success signal**: 一个 hello-world 类任务能跑完并自动转"待审核"

**Phase 5: 多 LLM 切换**
- **Goal**: 用户可在 UI 切换 Anthropic / 智谱 / Kimi
- **Scope**: 设置页：provider 选择 + base URL + API key + 模型名；引擎 spawn 时注入对应环境变量；提供三个预设（Anthropic 官方 / 智谱开放平台 / Moonshot 开放平台）
- **Success signal**: 切到智谱预设后任务也能跑通（依赖 Phase 7 spike）

**Phase 6: 移动端 PWA（最小）**
- **Goal**: 在手机上能录入任务并被桌面引擎消费
- **Scope**: PWA manifest + service worker；登录页 + 任务列表 + 任务创建表单；PouchDB IndexedDB 实例 + 双向同步到 CouchDB
- **Success signal**: iPhone 上添加任务，10 秒内桌面看见并自动进队

**Phase 7: 兼容性 spike（智谱/Kimi）**
- **Goal**: 验证 Claude Code 能否在国产兼容端点跑通工具调用
- **Scope**: 用 `ANTHROPIC_BASE_URL=<智谱>` 和 `<Kimi>` 各跑一次 `claude -p "list files in current dir"`；验证 Read/Bash 工具调用回包；记录差异
- **Success signal**: 两端点都能完成工具调用并返回结果；差异列表写入项目 `COMPATIBILITY.md`

**Phase 8: 子任务会话继承**
- **Goal**: 子任务自动 `--resume` 父任务 session
- **Scope**: 任务 doc 增加 `parentTaskId` 与 `claudeSessionId` 字段；首次执行解析 session_id 写回；执行子任务时若父有 session 则 `--resume <id>`；引擎按"父任务 + 所有子任务"作为一个执行单元
- **Success signal**: 创建一个父+两子任务，父先跑（产生 session_id），两子任务依次 `--resume` 同 session

**Phase 9: 进度日志**
- **Goal**: 任务详情页能看到 Claude Code 的逐步输出
- **Scope**: stream-json 解析 message 事件；流式写入任务 doc 的 `logs` 数组（或单独 doc 减小体积）；UI 详情页订阅刷新
- **Success signal**: 任务执行中实时在 UI 看到工具调用、文件改动、思考过程

**Phase 10: 多并发 + 项目级串行**
- **Goal**: 跨项目并发执行，同项目串行
- **Scope**: 引擎重构为"每项目一个 p-queue + 全局一个并发上限"；设置页加并发数滑块
- **Success signal**: 配置并发=3，3 个不同项目的任务真并行；同项目内的两个任务一前一后

**Phase 11: 移动端 CRUD 完整版**
- **Goal**: 手机端可独立完成全流程
- **Scope**: 编辑表单 + 删除 + 审核操作（标记待审核任务为 已完成/退回 待开发/已关闭）+ 简易日志查看
- **Success signal**: 出门在外只用手机也能完整跑一个任务

### Parallelism Notes

- Phase 3（桌面 UI）与 Phase 4（任务引擎）可并行：UI 用假数据驱动，引擎独立测试，最后联通
- Phase 5（多 LLM）与 Phase 6（PWA）可并行：分属配置层和移动层
- Phase 7（兼容性 spike）建议**最早**启动并独立完成（与 Phase 1 可并行），结果会反馈到 Phase 4 的实现细节
- Phase 8（子任务）与 Phase 9（日志）可并行：都依赖 Phase 4 的引擎能输出结构化数据

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 桌面框架 | Electron | Tauri / Flutter Desktop | 用户指定；生态成熟、与 Node 生态打通方便接 Claude SDK |
| 数据存储 | CouchDB + PouchDB | SQLite + WebSocket / Firebase / Supabase | 用户指定；离线优先 + 多端同步天然解，免造轮子 |
| 移除 PostgreSQL | CouchDB 自带认证 | 保留 PG 仅用于登录 | 用户决定；简化部署、减少服务、缩短 MVP 路径 |
| 任务引擎位置 | Electron 主进程 | 独立 Node 后台服务 / 系统服务 | 用户决定；MVP 简化，桌面关→任务暂停可接受 |
| Claude 调用方式 | `claude -p` 子进程 + stream-json | Claude Agent SDK Python/TS 包 | 子进程更轻、跨语言无关、命令行直接对应 LLM 切换的环境变量 |
| 并发控制 | `p-queue` | `workerpool` / 自造 | I/O-bound 场景 `p-queue` 最简洁，零依赖体积 |
| 多 LLM 切换 | 环境变量 `ANTHROPIC_BASE_URL` 切换 | 集成多 SDK | 智谱/Kimi 都提供 Claude 兼容端点，零代码切换 |
| 多用户隔离 | Database-Per-User | 单库 + 文档级权限 | DPU 离线表现更好、权限简单、备份天然分用户 |
| 任务模型 | 父任务 + 子任务（两层） | 任意层级树 | 用户明确双层；避免树形 UI 复杂度 |
| Kanban vs 状态机 | 状态机 + 自动流转 | 拖拽看板 | 产品差异化心智，避免与 Vibe Kanban 同质 |

---

## Research Summary

### Market Context

- **Anthropic 官方方向**（[Claude Code 桌面重构 2026/4/14](https://miraflow.ai/blog/claude-code-desktop-redesign-parallel-sessions-routines-workspace-guide)）：并行会话 + Routines（云端定时）+ [Remote Control](https://code.claude.com/docs/en/remote-control)（手机连本地）。重叠点：并行 + 移动端控制。差异点：官方是"会话"为单元，本产品是"任务"为单元 + 强制审核环节。
- **第三方 Kanban 类**（[Vibe Kanban](https://vibekanban.com/)、[Kangentic](https://kangentic.com/)、[Cline Kanban](https://cline.bot/kanban)、[ai-agent-board](https://github.com/DanWahlin/ai-agent-board)）：都做 Agent 不可知的多端编排，Kanban 拖拽心智，**没有强制人工审核环节**。差异点：本产品 Claude Code 专精 + 状态机心智 + 待审核必经。
- **手机端方案**（[Dispatch](https://www.mindstudio.ai/blog/what-is-claude-code-dispatch)、[247-claude-code-remote](https://github.com/QuivrHQ/247-claude-code-remote)）：手机做"远程控制一个会话"。差异点：本产品手机做"异步投递任务到队列"。
- **国内可用性盲区**：Anthropic 官方系列在国内网络与模型可用性上有门槛；**没有看到任何主流产品做"国内 LLM 兼容端点切换"**。这是真空地带。

### Technical Context

- **Claude Code Headless**（[官方文档](https://code.claude.com/docs/en/headless)）：`claude -p` + `--output-format json/stream-json` + `--resume <id>` + `--bare`，足够支持引擎调度。SDK 已重命名为 [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python)。
- **PouchDB+CouchDB**（[Couchbase 示例](https://github.com/couchbaselabs/todolite-electron-pouchdb)、[nolanlawson/pouchdb-electron](https://github.com/nolanlawson/pouchdb-electron)）：Electron 集成成熟，[Database-Per-User](https://medium.com/offline-camp/couchdb-pouchdb-and-hoodie-as-a-stack-for-progressive-web-apps-a6078a985f18) 是多用户离线优先标准方案。
- **任务并发**（[`p-queue`](https://www.npmjs.com/package/p-queue)）：I/O-bound 场景一行配置完成；CPU-bound 才需要 `workerpool`，本场景不适用。
- **国产 LLM Claude 兼容端点**：智谱 GLM 与 Kimi K2 都已提供，仅需切换 `ANTHROPIC_BASE_URL` —— 但需要 1 天兼容性 spike 验证工具调用细节。

---

*Generated: 2026-05-06*
*Status: DRAFT - 时间线已锁定：MVP 5-7 天 / 完整版 2-3 周，等待 /prp-plan 进入实施*
