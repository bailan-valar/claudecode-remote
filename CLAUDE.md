# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeCode Remote is an Electron desktop client for managing AI-powered development tasks. It uses PouchDB for local data storage with CouchDB sync, and integrates with Claude Code CLI for task execution.

**Tech Stack:** Electron + Vue 3 + TypeScript + PouchDB + Pinia

## Development Commands

```bash
# Development (with HMR)
npm run dev          # Main dev server (port 3456 renderer, 3457 API)
npm run dev:hmr      # HMR-enabled dev mode (port 8543 API)

# Building
npm run build        # Type-check + electron-vite build
npm run build:win    # Build Windows installer
npm run build:mac    # Build macOS installer
npm run build:linux # Build Linux packages

# Code Quality
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint with auto-fix
npm run format       # Prettier formatting

# Testing
npm run test         # Run tests (vitest)
```

> **注意：** 不要自动运行任何 `npm run` 构建脚本（如 `npm run build`、`npm run build:win` 等）。仅在用户明确要求时，才手动执行相关命令。

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# CouchDB connection
COUCHDB_URL=http://localhost:5984/cc-remote
COUCHDB_USER=your_username
COUCHDB_PASSWORD=your_password
COUCHDB_ADMIN_USER=admin    # Optional, for creating user DBs
COUCHDB_ADMIN_PASSWORD=     # Optional

# Web server port (for mobile access)
WEB_PORT=3457
```

CouchDB must have CORS enabled (`enable_cors = true` in `local.ini`).

## Architecture

### Process Structure

- **Main Process** (`src/main/`): Node.js backend, database, task engine
- **Renderer Process** (`src/renderer/`): Vue 3 frontend UI
- **Preload** (`src/preload/`): Context bridge for secure IPC
- **Shared** (`src/shared/`): TypeScript types shared between processes

### Key Directories

```
src/
├── main/
│   ├── index.ts           # App entry point, window creation
│   ├── ipc.ts             # IPC handler registration
│   ├── apiActions.ts      # Business logic for IPC handlers
│   ├── db.ts              # SyncManager for PouchDB <-> CouchDB
│   ├── configStore.ts     # App config persistence
│   ├── webServer.ts       # Express server for mobile web access
│   ├── engine/
│   │   ├── taskEngine.ts  # Task execution queue manager
│   │   ├── runner.ts      # Task runner interface
│   │   ├── claudeRunner.ts # Claude Code CLI integration
│   │   └── runnerRegistry.ts # Runner factory
│   └── repositories/      # PouchDB data access layer
│       ├── baseRepository.ts
│       ├── taskRepository.ts
│       └── projectRepository.ts
├── renderer/
│   └── src/
│       ├── api/index.ts   # API client (IPC + HTTP fallback)
│       ├── stores/        # Pinia stores
│       ├── views/         # Vue page components
│       └── components/    # Vue reusable components
└── shared/
    ├── types.ts           # Shared TypeScript interfaces
    └── constants.ts       # Shared constants
```

### Data Flow

1. **Renderer → Main:** API calls via `window.api` (IPC) or HTTP (`/api/*`)
2. **Main Process:** `apiActions.ts` handles business logic
3. **Repositories:** PouchDB CRUD operations with optimistic locking
4. **Events:** `mainEvents` EventEmitter broadcasts changes to renderer
5. **Renderer:** Pinia stores update via SSE events (web) or IPC events (desktop)

### Task Execution Flow

1. Task created with status `pending` or `plan_required`
2. TaskEngine watches PouchDB changes feed for pending tasks
3. On detection, engine queues task (with project-level serial + global concurrency control)
4. Runner (Claude Code CLI) executes task in project directory
5. Status updates: `pending` → `developing` → `reviewing` → `completed`
6. Webhook notifications sent on completion/failure (企业微信)

### Repository Pattern

All database access goes through repository classes in `src/main/repositories/`:

```typescript
// BaseRepository provides: findAll, findById, create, update, delete
// With built-in conflict retry (optimistic locking via _rev)

const taskRepo = createTaskRepository(db)
const task = await taskRepo.findById(taskId)
await taskRepo.update(taskId, { status: 'completed' })
```

Document IDs use prefixed UUIDs: `task:{uuid}`, `project:{uuid}`.

### IPC Communication

Desktop uses `ipcRenderer.invoke()` for requests and `ipcRenderer.on()` for events.

All IPC handlers are registered in `src/main/ipc.ts`. When adding new handlers:
1. Add handler in `ipc.ts` with `ipcMain.handle()`
2. Add corresponding method in `src/preload/index.ts`
3. Add TypeScript type to `Api` type in preload

### Dual-Mode API Client

The renderer API client (`src/renderer/src/api/index.ts`) supports two modes:
- **Electron:** Uses `window.api` (IPC bridge from preload)
- **Web:** Uses HTTP fetch + SSE for events (mobile access)

This allows the same UI to work in desktop app and mobile browser.

## Task Engine

The TaskEngine (`src/main/engine/taskEngine.ts`) manages async task execution:

- **Project-level serial:** Tasks in same project execute sequentially
- **Global concurrency:** Multiple projects can run in parallel (configurable)
- **Runners:** Pluggable execution engines (currently Claude Code CLI)
- **State persistence:** Engine state saved across restarts
- **Abort handling:** Tasks can be stopped mid-execution

## Adding Features

### New Database Entity

1. Add type to `src/shared/types.ts`
2. Create repository in `src/main/repositories/`
3. Add CRUD actions in `src/main/apiActions.ts`
4. Add IPC handlers in `src/main/ipc.ts`
5. Expose in preload `src/preload/index.ts`
6. Add API client methods in `src/renderer/src/api/index.ts`

### New Task Runner

1. Implement `TaskRunner` interface in `src/main/engine/`
2. Register in `src/main/engine/runnerRegistry.ts`
3. Update `ENGINE_PROVIDER` constants in `src/shared/constants.ts`

## Testing

Tests are in `src/main/**/__tests__/` and `src/renderer/**/__tests__/`.

Run with `npm run test` (vitest).

## Build Configuration

- **electron-vite.config.ts:** Vite config for main/preload/renderer
- **tsconfig.json:** Project references (node + web)
- **package.json:** Electron builder config for installers

The build uses `electron-vite` which bundles:
- Main: Node.js target (no browser polyfills)
- Preload: Isolated context
- Renderer: Vue 3 SPA with Vite dev server
