# 🔥 HMR 快速参考卡

## 一键启动
```bash
npm run dev  # 启动开发环境 + HMR
```

## 配置文件位置
- `electron.vite.config.ts` - Vite配置
- `hmr.config.json` - HMR行为配置

## 关键API
```bash
# 状态查询
curl http://localhost:3456/api/hmr/status

# 控制接口
curl -X POST http://localhost:3456/api/hmr/stop
curl -X POST http://localhost:3456/api/hmr/start
curl -X POST http://localhost:3456/api/hmr/reload
```

## 重载策略
- **渲染进程**: `hmr` - 热更新，状态保持
- **主进程**: `restart` - 自动重启应用
- **预加载**: `reload` - 重载窗口
- **项目文件**: `notify` - 仅通知

## 常见问题
❓ **热重载不工作?**  
✅ 检查 `hmr.config.json` 中 `enabled: true`

❓ **修改后没反应?**  
✅ 查看控制台 `[HMR]` 日志

❓ **需要重启应用?**  
✅ 主进程代码修改会自动重启

## 测试验证
```bash
node test-hmr.js  # 运行测试脚本
```

## 性能优化
- 调整 `debounceDelay: 300` 防抖延迟
- 配置 `ignoredPaths` 减少监听文件
- 使用 `usePolling: true` 解决文件系统问题

## 实时事件
```javascript
const eventSource = new EventSource('http://localhost:3456/api/events')
eventSource.addEventListener('hmr:notification', (e) => {
  console.log('HMR:', JSON.parse(e.data))
})
```

## 前端组件
```vue
<HMRStatus />  <!-- 实时监控HMR状态 -->
```

---
📖 详细文档: `HMR_GUIDE.md`  
🎓 使用示例: `HMR_USAGE_EXAMPLES.md`  
✅ 实现状态: 完全实现并测试通过
