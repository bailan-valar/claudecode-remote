# 方案3: 热重载配置方案 - 完整实现指南

## 📋 方案概述

方案3通过集成Electron-Vite的热重载(HMR)功能，实现开发时的实时代码更新，无需重启整个应用。

## 🎯 核心特性

- ✅ **实时热重载**: 代码修改后立即生效，无需重启
- ✅ **智能文件监听**: 自动检测源代码文件变化
- ✅ **多策略支持**: 主进程、渲染进程、预加载脚本分别处理
- ✅ **开发体验优化**: 开发时无需手动重启，提高效率
- ✅ **配置化管理**: 通过配置文件灵活控制重载行为

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────┐
│              Electron-Vite HMR                   │
├─────────────────────────────────────────────────┤
│  主进程热重载    │  渲染进程热重载  │  文件监听  │
│  (Main Process)  │  (Renderer)      │  (Watcher) │
├─────────────────────────────────────────────────┤
│              HMR管理器                           │
│         (hmrManager.ts)                          │
├─────────────────────────────────────────────────┤
│        配置系统 + API接口 + 前端组件             │
└─────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 基础配置

配置已集成在 `electron.vite.config.ts` 中：

```typescript
export default defineConfig({
  main: {
    watch: {
      ignored: ['**/node_modules/**', '**/out/**', '**/.git/**']
    }
  },
  renderer: {
    server: {
      hmr: true,
      watch: {
        ignored: ['**/node_modules/**', '**/out/**'],
        aggregateTimeout: 300  // 防抖延迟
      }
    }
  }
})
```

### 2. 启动开发环境

```bash
# 启动开发环境（HMR自动启用）
npm run dev

# 或者使用外部监控
npm run dev:watch
```

### 3. 配置文件

创建 `hmr.config.json` 来自定义行为：

```json
{
  "enabled": true,
  "reloadOnFileChange": true,
  "watchedPaths": {
    "main": ["src/main/**/*.ts"],
    "renderer": ["src/renderer/**/*"],
    "preload": ["src/preload/**/*"],
    "projects": ["cc-remote-admin/**/*", "cc-remote-local/**/*"]
  },
  "reloadStrategy": {
    "mainProcess": "restart",      // 主进程变化重启
    "rendererProcess": "hmr",      // 渲染进程热重载
    "preloadScripts": "reload",    // 预加载脚本重载窗口
    "projectChanges": "notify"     // 项目变化只通知
  }
}
```

## 🔧 使用方法

### 实时开发流程

1. **修改渲染进程代码** (`.vue`, `.ts`, `.css`)
   - 自动热重载，界面立即更新
   - 状态保持，无需重新操作

2. **修改预加载脚本**
   - 自动重载窗口
   - 主进程保持运行

3. **修改主进程代码**
   - 自动重启整个应用
   - 保持开发状态

### API控制

```javascript
// 获取HMR状态
const response = await fetch('http://localhost:3456/api/hmr/status')
const status = await response.json()

// 停止HMR
await fetch('http://localhost:3456/api/hmr/stop', { method: 'POST' })

// 启动HMR
await fetch('http://localhost:3456/api/hmr/start', { method: 'POST' })

// 重新加载配置
await fetch('http://localhost:3456/api/hmr/reload', { method: 'POST' })
```

### IPC调用

```typescript
// 在渲染进程中
const hmrStatus = await ipcRenderer.invoke('hmr:status')
await ipcRenderer.invoke('hmr:stop')
await ipcRenderer.invoke('hmr:start')
await ipcRenderer.invoke('hmr:reload')
```

## 🎨 前端组件

使用 `HMRStatus.vue` 组件监控和控制HMR：

```vue
<template>
  <HMRStatus />
</template>

<script setup>
import HMRStatus from '@/components/HMRStatus.vue'
</script>
```

## 📊 实时事件监听

通过SSE接收HMR事件：

```typescript
const eventSource = new EventSource('http://localhost:3456/api/events')

eventSource.addEventListener('hmr:notification', (event) => {
  const data = JSON.parse(event.data)
  console.log('HMR通知:', data)
})

eventSource.addEventListener('hmr:project-changed', (event) => {
  const data = JSON.parse(event.data)
  console.log('项目变化:', data.projects)
})
```

## ⚙️ 高级配置

### 1. 性能优化

```json
{
  "advanced": {
    "usePolling": false,          // 使用轮询（某些系统更可靠）
    "pollingInterval": 100,        // 轮询间隔
    "aggregateTimeout": 200,       // 防抖延迟
    "atomicWrites": true,          // 原子写入
    "ignoreInitial": true          // 忽略初始扫描
  }
}
```

### 2. 通知配置

```json
{
  "notifications": {
    "enabled": true,
    "position": "top-right",
    "duration": 3000,
    "types": {
      "mainProcess": "主进程已更新",
      "rendererProcess": "界面已热更新", 
      "error": "更新过程中出现错误"
    }
  }
}
```

### 3. 忽略文件模式

```json
{
  "ignoredPaths": [
    "**/node_modules/**",
    "**/out/**",
    "**/dist/**",
    "**/.git/**",
    "**/*.log",
    "**/coverage/**",
    "**/test-results/**"
  ]
}
```

## 🛠️ 故障排除

### 问题1: 热重载不工作

**解决方案**:
1. 检查 `hmr.config.json` 中的 `enabled` 是否为 `true`
2. 确认文件路径模式正确
3. 查看控制台是否有 `[HMR]` 日志

### 问题2: 主进程修改后未重启

**解决方案**:
1. 检查 `reloadStrategy.mainProcess` 是否为 `"restart"`
2. 查看重启管理器是否正常工作
3. 检查文件监听是否正确触发

### 问题3: 渲染进程修改后界面不更新

**解决方案**:
1. 确认开发服务器正在运行
2. 检查浏览器控制台是否有错误
3. 尝试手动刷新页面

### 问题4: 文件监听过于频繁

**解决方案**:
1. 增加 `debounceDelay` 值
2. 检查 `ignoredPaths` 是否正确配置
3. 考虑使用 `usePolling: true`

## 📈 性能对比

| 方案 | 启动时间 | 更新速度 | 内存占用 | 开发体验 |
|------|----------|----------|----------|----------|
| 方案3 (HMR) | 中等 | 最快 | 中等 | 最佳 |
| 方案1 (事件重启) | 快 | 慢 | 低 | 良好 |
| 方案2 (外部监控) | 慢 | 慢 | 低 | 一般 |

## 🎯 最佳实践

### 开发阶段
```bash
# 使用HMR模式
npm run dev

# 配置文件启用所有热重载
{
  "enabled": true,
  "reloadStrategy": {
    "rendererProcess": "hmr"  // 渲染进程使用HMR
  }
}
```

### 调试阶段
```json
{
  "notifications": {
    "enabled": true  // 启用通知了解变化
  },
  "reloadStrategy": {
    "mainProcess": "restart"  // 主进程变化立即重启
  }
}
```

### 生产构建
```bash
# 构建时HMR自动禁用
npm run build

# 或显式禁用
NODE_ENV=production npm run dev
```

## 🔍 监控和调试

### 查看HMR状态

```bash
# 检查配置文件
cat hmr.config.json

# 查看运行状态
curl http://localhost:3456/api/hmr/status
```

### 日志分析

在开发者工具中查看 `[HMR]` 开头的日志：

```
[HMR] Starting Hot Module Replacement...
[HMR] Started watcher: main
[HMR] Started watcher: projects
[HMR] File changed [projects]: cc-remote-admin/src/app.vue
[HMR] Processing 1 file changes from projects
```

## 🚨 注意事项

1. **生产环境**: HMR仅在开发环境启用，生产构建时自动禁用
2. **性能影响**: 文件监听会占用一定系统资源，可根据需要调整
3. **网络依赖**: 渲染进程HMR依赖WebSocket，确保网络正常
4. **状态保持**: 某些重载操作会清空应用状态，请提前保存工作

## 📚 相关文件

```
├── electron.vite.config.ts      # Vite配置
├── hmr.config.json              # HMR配置
├── src/main/
│   ├── index.ts                 # 主进程（HMR集成）
│   └── utils/
│       └── hmrManager.ts        # HMR管理器
├── src/renderer/src/components/
│   └── HMRStatus.vue            # HMR状态组件
└── HMR_GUIDE.md                 # 本指南
```

## 🎉 总结

方案3通过热重载配置提供了最佳的开发体验：

- **无需重启**: 大部分代码修改实时生效
- **状态保持**: 界面状态在更新中保持
- **高效开发**: 大幅减少开发中的等待时间
- **灵活配置**: 可根据需要调整重载策略

推荐在开发阶段使用此方案，能显著提升开发效率和体验。
