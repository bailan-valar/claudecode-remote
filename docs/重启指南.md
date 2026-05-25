# 任务完成后重新构建运行方案

## 问题背景

当任务引擎完成一项任务后，系统需要关闭已运行的 `npm run dev` 并重新执行，以加载最新的更改。

## 可用方案

### 方案1: 内置事件监听重启（推荐）

**优点**: 
- 集成在主进程中，响应及时
- 可以保存重启状态
- 支持取消和延迟配置

**使用方法**:
```bash
# 正常启动，任务完成后会自动重启
npm run dev
```

**配置**: 编辑 `restart.config.json`:
```json
{
  "restart": {
    "autoRestartOnTaskComplete": true,
    "restartDelay": 3000
  }
}
```

### 方案2: 外部监控脚本

**优点**:
- 独立于主进程运行
- 支持文件变化监控
- 更灵活的重启策略

**使用方法**:
```bash
# 使用外部监控脚本启动
npm run dev:watch
```

**特性**:
- 监控多个目录的文件变化
- 自动检测任务完成状态
- 重启次数限制保护

### 方案3: 热重载配置

**优点**:
- 开发时无需重启
- 更快的开发体验

**配置**: 已在 `electron.vite.config.ts` 中配置：
```typescript
watch: {
  ignored: ['**/node_modules/**', '**/out/**']
}
```

### 方案4: 手动重启API

**新增IPC接口**:
```typescript
// 前端调用
ipcRenderer.invoke('system:restart', { reason: 'manual' })

// 或通过Web API
fetch('/api/system/restart', {
  method: 'POST',
  body: JSON.stringify({ reason: 'manual' })
})
```

## 配置选项

### restart.config.json

```json
{
  "enabled": true,                          // 总开关
  "restart": {
    "autoRestartOnTaskComplete": true,      // 任务完成后自动重启
    "restartDelay": 3000,                   // 重启延迟(毫秒)
    "maxRestartsPerHour": 20                // 每小时最大重启次数
  },
  "watch": {
    "enabled": true,                        // 启用文件监控
    "directories": [                        // 监控目录
      "cc-remote-admin",
      "cc-remote-local", 
      "cc-remote-nick"
    ],
    "filePatterns": [                       // 文件模式
      "package.json",
      "dist/**/*"
    ]
  },
  "safeMode": {
    "enabled": false                        // 安全模式（不自动重启）
  }
}
```

## 使用场景

### 开发阶段
```bash
# 使用热重载模式
npm run dev
```

### 测试阶段
```bash
# 使用自动重启模式
npm run dev:watch
```

### 生产部署
```json
// 设置为安全模式，不自动重启
{
  "safeMode": {
    "enabled": true
  }
}
```

## 监控和调试

### 查看重启日志
```bash
# 查看当前重启状态
cat ~/Library/Application\ Support/claudecode-remote/restart-state.json
```

### 手动触发重启
```javascript
// 在浏览器控制台
fetch('/api/system/restart', {
  method: 'POST',
  body: JSON.stringify({ reason: 'manual_test' })
})
```

### 取消待处理的重启
```javascript
// 在主进程中
const { getRestartManager } = require('./src/main/utils/restartManager')
const manager = getRestartManager()
manager.cancelRestart()
```

## 故障排除

### 重启失败
1. 检查日志: `[RestartManager]` 开头的日志
2. 检查重启次数限制: `maxRestartsPerHour`
3. 启用安全模式排查问题

### 重启过于频繁
1. 增加 `restartDelay` 延迟时间
2. 调整 `maxRestartsPerHour` 限制
3. 检查是否有任务循环完成的情况

### 文件监控不工作
1. 确认 `watch.enabled: true`
2. 检查监控目录路径是否正确
3. 查看文件模式配置是否匹配

## 最佳实践

1. **开发阶段**: 使用方案1（内置事件监听），开发体验最佳
2. **CI/CD**: 使用方案2（外部监控），更稳定可靠
3. **生产环境**: 禁用自动重启，使用手动部署
4. **调试阶段**: 启用安全模式，避免意外重启

## 技术架构

```
┌─────────────────┐
│   TaskEngine    │ 任务完成事件
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RestartManager  │ 重启管理器
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Config Reader  │ 配置读取
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Manager │ 进程管理
└─────────────────┘
```

## 文件结构

```
src/
├── main/
│   ├── index.ts                    # 主进程（集成重启逻辑）
│   └── utils/
│       ├── restartManager.ts       # 重启管理器
│       └── restartConfig.ts        # 配置读取器
├── restart.config.json            # 配置文件
└── restart-manager.js             # 外部监控脚本
```

## 扩展开发

### 添加自定义重启条件

```typescript
// 在 RestartManager 中添加
checkCustomCondition(): boolean {
  // 你的自定义逻辑
  return true // 触发重启
}
```

### 添加重启钩子

```typescript
// 在 restart.config.json 中添加
{
  "hooks": {
    "beforeRestart": "./scripts/before-restart.js",
    "afterRestart": "./scripts/after-restart.js"
  }
}
```

## 总结

推荐使用 **方案1（内置事件监听重启）**，它提供了最佳的开发体验和系统稳定性。如果需要更复杂的监控逻辑，可以考虑 **方案2（外部监控脚本）**。
