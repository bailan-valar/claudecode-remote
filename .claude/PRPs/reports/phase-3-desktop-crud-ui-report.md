# Implementation Report: Phase 3 — 桌面 CRUD UI 完善

## Summary
完成桌面端任务与项目的完整 CRUD 体验：状态流转按钮、按项目/状态过滤、编辑/删除、详情页面、本地路径文件选择器、首页数据看板。

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | High | High |
| Files Changed | 20 (10 新建 + 10 修改) | 19 (9 新建 + 10 修改) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | 任务状态机工具函数 | [done] Complete | |
| 2 | 状态机单元测试 | [done] Complete | |
| 3 | 状态徽章组件 | [done] Complete | |
| 4 | 任务状态流转按钮组 | [done] Complete | |
| 5 | 任务过滤器组件 | [done] Complete | |
| 6 | 确认弹窗组件 | [done] Complete | |
| 7 | 空状态组件 | [done] Complete | |
| 8 | 任务详情页 | [done] Complete | |
| 9 | 修改 TaskForm 支持编辑模式 | [done] Complete | |
| 10 | 项目详情页 | [done] Complete | |
| 11 | 修改 ProjectForm 支持编辑和路径选择 | [done] Complete | |
| 12 | 修改 TasksView — 集成过滤和操作 | [done] Complete | |
| 13 | 修改 ProjectsView — 集成编辑和删除 | [done] Complete | |
| 14 | 修改 HomeView — 添加统计看板 | [done] Complete | |
| 15 | 修改 useTaskStore — 补充 update 方法和统计 | [done] Complete | |
| 16 | 修改路由 — 添加详情页路由 | [done] Complete | |
| 17 | 修改 main/ipc.ts — 注册目录选择 handler | [done] Complete | |
| 18 | 修改 preload/index.ts — 暴露 selectDirectory API | [done] Complete | |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | [done] Pass | typecheck:node + typecheck:web 零错误 |
| Unit Tests | [done] Pass | 12 tests total (7 new + 5 existing) |
| Build | [done] Pass | electron-vite build 成功 |
| Integration | N/A | 需手动在 Electron 中验证 |
| Edge Cases | N/A | 需手动验证 |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/renderer/src/utils/taskTransitions.ts` | CREATED | +52 |
| `src/renderer/src/utils/__tests__/taskTransitions.test.ts` | CREATED | +36 |
| `src/renderer/src/components/StatusBadge.vue` | CREATED | +36 |
| `src/renderer/src/components/TaskStatusActions.vue` | CREATED | +47 |
| `src/renderer/src/components/TaskFilters.vue` | CREATED | +53 |
| `src/renderer/src/components/ConfirmDialog.vue` | CREATED | +54 |
| `src/renderer/src/components/EmptyState.vue` | CREATED | +19 |
| `src/renderer/src/views/TaskDetailView.vue` | CREATED | +121 |
| `src/renderer/src/views/ProjectDetailView.vue` | CREATED | +110 |
| `src/renderer/src/views/HomeView.vue` | UPDATED | +36 / -0 |
| `src/renderer/src/views/TasksView.vue` | UPDATED | +108 / -51 |
| `src/renderer/src/views/ProjectsView.vue` | UPDATED | +88 / -39 |
| `src/renderer/src/components/TaskForm.vue` | UPDATED | +80 / -52 |
| `src/renderer/src/components/ProjectForm.vue` | UPDATED | +71 / -44 |
| `src/renderer/src/stores/useTaskStore.ts` | UPDATED | +30 / -14 |
| `src/renderer/src/router/index.ts` | UPDATED | +4 / -1 |
| `src/main/ipc.ts` | UPDATED | +10 / -1 |
| `src/preload/index.ts` | UPDATED | +4 / -1 |

## Deviations from Plan

| # | What | Why |
|---|---|---|
| 1 | 测试导入路径从 `../../../shared/constants` 改为 `../../../../shared/constants` | vitest 从 `__tests__` 子目录解析，需要多一层 `../` |
| 2 | TaskDetailView 和 ProjectDetailView 的 `handleUpdate` 参数改为可选 (`changes?:`) | TaskForm/ProjectForm emit 签名中 `changes` 为可选，视图 handler 必须兼容 |
| 3 | ProjectsView 内联 edit handler 添加 `$event &&` 守卫 | 处理 `$event` 为 undefined 的类型不匹配 |
| 4 | TaskDetailView line 85 使用 `task!.projectId` | vue-tsc 在 v-else 分支仍认为 task 可能 undefined，使用非空断言 |

## Issues Encountered

### Issue 1: Vitest 模块解析路径
- **Symptom**: `Cannot find module '../../../shared/constants'`
- **Root cause**: 测试文件位于 `__tests__` 子目录，相对路径需要多一层 `../`
- **Fix**: 将导入改为 `../../../../shared/constants`

### Issue 2: Vue emit 可选参数类型不匹配
- **Symptom**: `Type '(changes: Partial<Project>) => Promise<void>' is not assignable to type '(changes?: Partial<Project> | undefined) => any'`
- **Root cause**: Form 组件 edit 模式下 emit 的 `changes` 可为 undefined（字段无变化时），但视图 handler 要求必填
- **Fix**: 将 handler 参数声明为可选，并添加 `if (!changes) return` 守卫

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `src/renderer/src/utils/__tests__/taskTransitions.test.ts` | 7 tests | getAllowedNext 6 个状态 + STATUS_LABEL 全覆盖 |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`
