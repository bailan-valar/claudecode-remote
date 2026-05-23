# Keep-Alive 页面缓存功能说明

本项目已经实现了完整的 Vue 3 `keep-alive` 页面缓存功能，可以保持页面状态，提升用户体验。

## 功能特性

### 1. 自动缓存管理
- 根据路由配置自动管理页面缓存
- 支持 `include` 和 `exclude` 动态控制
- 全局缓存管理器统一管理所有缓存

### 2. 路由级别的缓存控制
每个路由都可以配置独立的缓存策略：

```typescript
// router/index.ts
{
  path: '/projects',
  name: 'projects',
  component: ProjectsView,
  meta: { 
    keepAlive: true,    // 启用缓存
    cacheName: 'projects' // 缓存名称（可选）
  }
}
```

### 3. 动态缓存控制
可以通过路由的 `meta.keepAlive` 属性动态控制是否缓存：

```typescript
// 启用缓存
meta: { keepAlive: true }

// 禁用缓存
meta: { keepAlive: false }
```

## 使用方法

### 基本使用

#### 1. 路由配置
在 `src/renderer/src/router/index.ts` 中配置路由：

```typescript
{
  path: '/tasks',
  name: 'tasks',
  component: TasksView,
  meta: { 
    keepAlive: true,    // 启用缓存
    cacheName: 'tasks'  // 指定缓存名称
  }
}
```

#### 2. 组件配置
确保组件有正确的 `name` 属性：

```vue
<script setup lang="ts">
import { defineOptions } from 'vue'

defineOptions({
  name: 'TasksView' // 组件名称，用于 keep-alive 识别
})
</script>
```

### 高级用法

#### 1. 手动控制缓存
使用缓存管理器进行精细控制：

```typescript
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

// 添加到缓存
manager.addToCache('TasksView')

// 从缓存移除
manager.removeFromCache('TasksView')

// 清空所有缓存
manager.clearAllCache()
```

#### 2. 预加载缓存
在需要时预加载特定页面的缓存：

```typescript
// 预加载项目详情页缓存
await manager.preloadCache('project-detail')
```

#### 3. 动态排除缓存
临时排除某个页面的缓存：

```typescript
// 添加到排除列表
manager.addToExclude('TasksView')

// 从排除列表移除
manager.removeFromExclude('TasksView')
```

## 当前项目配置

### 已配置缓存的页面

1. **HomeView** (首页)
   - 路由: `/`
   - 缓存: 启用
   - 缓存名: `home`

2. **ProjectsView** (项目列表)
   - 路由: `/projects`
   - 缓存: 启用
   - 缓存名: `projects`

3. **ProjectDetailView** (项目详情)
   - 路由: `/projects/:id`
   - 缓存: 启用
   - 缓存名: `project-detail`

4. **TasksView** (任务列表)
   - 路由: `/tasks`
   - 缓存: 启用
   - 缓存名: `tasks`

5. **TaskDetailView** (任务详情)
   - 路由: `/tasks/:id`
   - 缓存: 启用
   - 缓存名: `task-detail`

6. **LoginView** (登录页)
   - 路由: `/login`
   - 缓存: 禁用
   - 原因: 登录页面不需要缓存

## 缓存生命周期

### 组件生命周期钩子
当组件被 keep-alive 缓存时，会有额外的生命周期钩子：

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'

// 首次挂载时执行
onMounted(() => {
  console.log('组件首次挂载')
})

// 组件卸载时执行（非缓存状态）
onUnmounted(() => {
  console.log('组件卸载')
})

// 组件激活时执行（从缓存中恢复）
onActivated(() => {
  console.log('组件从缓存中激活')
  // 适合刷新数据
})

// 组件停用时执行（被缓存）
onDeactivated(() => {
  console.log('组件被缓存')
})
</script>
```

## 性能优化建议

### 1. 合理使用缓存
- **适合缓存的页面**: 列表页、查询页、表单页
- **不适合缓存的页面**: 登录页、支付页、实时数据页

### 2. 及时清理缓存
- 数据变更后及时清理相关缓存
- 用户登出时清空所有缓存

### 3. 控制缓存数量
- 设置合理的 `include` 和 `exclude`
- 避免缓存过多页面导致内存占用过高

## 常见问题

### Q: 为什么页面没有保持状态？
A: 请检查：
1. 路由配置中 `meta.keepAlive` 是否为 `true`
2. 组件是否设置了正确的 `name` 属性
3. 是否在代码中手动清理了缓存

### Q: 如何强制刷新缓存页面？
A: 可以在 `onActivated` 钩子中刷新数据：

```typescript
onActivated(() => {
  // 刷新数据
  fetchData()
})
```

### Q: 如何清除特定页面的缓存？
A: 使用缓存管理器：

```typescript
manager.removeFromCache('TasksView')
```

## 技术实现

### 核心文件
1. **App.vue**: 主应用组件，包含 keep-alive 模板
2. **router/index.ts**: 路由配置
3. **utils/keepAliveManager.ts**: 缓存管理工具
4. **views/**: 各个视图组件

### 实现原理
1. Vue Router 的 `meta` 字段控制缓存策略
2. `keep-alive` 组件的 `include` 和 `exclude` 属性过滤组件
3. 全局缓存管理器统一管理缓存状态
4. 组件的 `name` 属性用于识别和匹配缓存

## 总结

本项目的 keep-alive 功能提供了：
- ✅ 自动化的缓存管理
- ✅ 灵活的缓存控制
- ✅ 完善的生命周期管理
- ✅ 良好的开发体验

通过合理使用缓存功能，可以显著提升应用的性能和用户体验。
