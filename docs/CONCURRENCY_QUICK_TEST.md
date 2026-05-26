# 并发问题快速验证指南

## 问题现象
- 任务引擎可能同时运行同一个任务
- 相同任务被多次入队
- 项目级串行失效

## 修复验证步骤

### 1. 启动应用
```bash
npm run dev
```

### 2. 观察控制台日志
在以下场景中观察并发控制是否生效：

#### 场景A: 快速创建多个相同状态的任务
1. 创建一个项目
2. 快速添加多个 PENDING 状态的任务
3. 观察日志中是否出现重复入队的阻止消息

**预期日志：**
```
[engine] task task-123 is already being enqueued, waiting...
[engine] task task-123 is already queued, skipping duplicate enqueue
```

#### 场景B: 任务状态快速变化
1. 启动一个任务执行
2. 在执行过程中手动停止任务
3. 再次启动相同任务

**预期日志：**
```
[engine] task task-123 status changed to STOPPED, skipping execution
```

#### 场景C: 项目级并发测试
1. 创建一个项目的多个任务
2. 设置并发数 > 1
3. 观察同一项目的任务是否串行执行

**预期行为：**
- 同一项目任务不会同时执行
- 不同项目任务可以并发执行

### 3. 关键日志指标

#### 正常运行的日志
```
[engine] enqueuing task task-123 (status: pending, queue size: 2)
[engine] task task-123 removed from queue
```

#### 并发控制工作的日志
```
[engine] task task-123 is already running, skipping enqueue
[engine] task task-123 started running while waiting for lock, skipping
[engine] task task-123 status changed to DEVELOPING, skipping execution
```

#### 异常情况日志
```
[engine] task task-123 status conflict, current: DEVELOPING, skipping execution
```

### 4. 数据库验证

检查 PouchDB 中的任务状态：
```javascript
// 在浏览器控制台或 main process 中执行
const tasks = await db.allDocs({ include_docs: true })
const runningTasks = tasks.rows.filter(r => 
  ['DEVELOPING', 'PLANNING'].includes(r.doc.status)
)
console.log('正在运行的任务:', runningTasks.map(t => t.id))
```

**预期结果：** 同一个任务 ID 不应出现多次

### 5. 性能监控

在开发者工具中监控：
- 内存使用：应该保持稳定，锁会自动清理
- CPU 使用：不应出现异常的并发峰值
- 网络请求：API 调用应该按预期串行

### 6. 边缘情况测试

#### 重启恢复测试
1. 启动任务执行
2. 在执行过程中重启应用
3. 检查是否有任务重复执行

**预期结果：** 
- 重启后任务状态正确恢复
- 没有重复执行

#### 高并发压力测试
1. 设置并发数为最大值
2. 同时创建大量任务
3. 观察 system 稳定性

**预期结果：**
- 系统保持稳定
- 所有任务按序执行
- 没有内存泄漏

## 故障排除

### 问题1: 仍然看到重复执行
**可能原因：** 锁机制失效
**解决方案：** 
1. 检查 `taskEnqueueLocks` 是否正常工作
2. 查看日志中的锁相关信息
3. 重启引擎

### 问题2: 内存使用持续增长
**可能原因：** 锁未正确清理
**解决方案：**
1. 检查 `setTimeout` 清理逻辑
2. 手动触发垃圾回收
3. 重启应用

### 问题3: 任务卡住不执行
**可能原因：** 死锁
**解决方案：**
1. 检查 `projectLocks` 状态
2. 清理卡住的项目锁
3. 重启引擎

## 自动化测试

```bash
# 运行类型检查
npm run typecheck

# 启动开发服务器
npm run dev

# 观察日志输出
# 应该看到清晰的并发控制日志
```

## 成功标准

✅ 没有重复执行同一任务的日志
✅ 并发阻止消息正常出现
✅ 内存使用保持稳定
✅ 任务按预期状态转换
✅ 项目级串行正常工作

## 联系支持

如果问题仍然存在，请提供：
1. 完整的控制台日志
2. 复现步骤
3. PouchDB 中的任务状态快照
4. 系统资源使用情况
