# Keep-Alive 使用示例

本文档提供了在实际项目中使用 keep-alive 功能的具体示例。

## 基础用法示例

### 1. 在组件中监听缓存生命周期

```vue
<script setup lang="ts">
import { onMounted, onActivated, onDeactivated } from 'vue'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

// 首次挂载时执行
onMounted(() => {
  console.log('组件首次挂载')
  fetchData()
})

// 从缓存中激活时执行
onActivated(() => {
  console.log('组件从缓存中激活')
  // 可以在这里刷新数据，保持页面状态的同时获取最新数据
  refreshData()
})

// 被缓存时执行
onDeactivated(() => {
  console.log('组件被缓存')
  // 保存当前状态，清理定时器等
  saveState()
})

function fetchData() {
  // 获取数据
}

function refreshData() {
  // 刷新数据（轻量级更新）
}

function saveState() {
  // 保存状态
}
</script>
```

### 2. 手动控制缓存

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

onMounted(() => {
  // 预加载其他页面的缓存
  manager.preloadCache('projects')
  manager.preloadCache('tasks')
})

function handleDataChange() {
  // 数据变更后，清除相关页面的缓存
  manager.removeFromCache('TasksView')
}

function handleLogout() {
  // 用户登出时清空所有缓存
  manager.clearAllCache()
}
</script>
```

## 高级用法示例

### 1. 条件缓存控制

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const route = useRoute()
const manager = getGlobalKeepAliveManager()
const shouldCache = ref(true)

// 根据数据状态动态控制缓存
watch(shouldCache, (newValue) => {
  const componentName = 'TasksView'
  
  if (newValue) {
    manager.addToCache(componentName)
    manager.removeFromExclude(componentName)
  } else {
    manager.removeFromCache(componentName)
    manager.addToExclude(componentName)
  }
})

function handleEditMode() {
  // 进入编辑模式时禁用缓存
  shouldCache.value = false
}

function handleViewMode() {
  // 返回查看模式时启用缓存
  shouldCache.value = true
}
</script>
```

### 2. 缓存统计和监控

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCacheStatistics } from '@/utils/keepAliveManager'

const cacheStats = ref({
  currentCacheCount: 0,
  totalHits: 0,
  totalMisses: 0,
  hitRate: 0
})

function updateStats() {
  cacheStats.value = getCacheStatistics()
  console.log('缓存统计:', cacheStats.value)
}

onMounted(() => {
  // 每10秒更新一次统计信息
  setInterval(updateStats, 10000)
  updateStats()
})
</script>

<template>
  <div class="cache-stats">
    <h3>缓存统计</h3>
    <p>当前缓存数量: {{ cacheStats.currentCacheCount }}</p>
    <p>缓存命中次数: {{ cacheStats.totalHits }}</p>
    <p>缓存未命中次数: {{ cacheStats.totalMisses }}</p>
    <p>缓存命中率: {{ cacheStats.hitRate.toFixed(2) }}%</p>
  </div>
</template>
```

### 3. 智能缓存刷新策略

```vue
<script setup lang="ts">
import { ref, onActivated } from 'vue'
import { useTaskStore } from '@/stores/useTaskStore'

const taskStore = useTaskStore()
const lastRefreshTime = ref(0)
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5分钟

onActivated(() => {
  const now = Date.now()
  
  // 只有超过刷新间隔时才刷新数据
  if (now - lastRefreshTime.value > REFRESH_INTERVAL) {
    console.log('刷新任务列表')
    taskStore.fetch()
    lastRefreshTime.value = now
  } else {
    console.log('使用缓存数据，距离上次刷新:', Math.floor((now - lastRefreshTime.value) / 1000), '秒')
  }
})

function manualRefresh() {
  taskStore.fetch()
  lastRefreshTime.value = Date.now()
}
</script>

<template>
  <div class="task-list">
    <button @click="manualRefresh">手动刷新</button>
    <!-- 任务列表内容 -->
  </div>
</template>
```

## 特定场景示例

### 1. 表单页面缓存

```vue
<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue'

const formData = ref({
  name: '',
  email: '',
  message: ''
})

// 保存表单草稿
onDeactivated(() => {
  localStorage.setItem('form-draft', JSON.stringify(formData.value))
})

// 恢复表单草稿
onActivated(() => {
  const draft = localStorage.getItem('form-draft')
  if (draft) {
    formData.value = JSON.parse(draft)
  }
})

function submitForm() {
  // 提交表单逻辑
  localStorage.removeItem('form-draft') // 清除草稿
}
</script>
```

### 2. 列表页面缓存

```vue
<script setup lang="ts">
import { ref, onActivated, computed } from 'vue'
import { useTaskStore } from '@/stores/useTaskStore'

const taskStore = useTaskStore()
const scrollPosition = ref(0)

// 恢复滚动位置
onActivated(() => {
  window.scrollTo(0, scrollPosition.value)
  // 轻量级数据更新
  taskStore.fetchUpdates()
})

// 保存滚动位置
onDeactivated(() => {
  scrollPosition.value = window.scrollY
})

const tasks = computed(() => taskStore.tasks)
</script>

<template>
  <div class="task-list">
    <div v-for="task in tasks" :key="task.id">
      {{ task.title }}
    </div>
  </div>
</template>
```

### 3. 详情页面缓存

```vue
<script setup lang="ts">
import { ref, watch, onActivated } from 'vue'
import { useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/useTaskStore'

const route = useRoute()
const taskStore = useTaskStore()
const currentTask = ref(null)

// 监听路由参数变化
watch(() => route.params.id, async (newId) => {
  if (newId) {
    await loadTask(newId as string)
  }
}, { immediate: true })

// 激活时检查是否需要刷新
onActivated(() => {
  // 检查数据是否过期，如果需要则刷新
  if (isDataExpired()) {
    loadTask(route.params.id as string)
  }
})

async function loadTask(id: string) {
  currentTask.value = await taskStore.fetchById(id)
}

function isDataExpired() {
  // 检查数据是否过期的逻辑
  return false
}
</script>
```

## 最佳实践

### 1. 合理设置缓存策略

```typescript
// 路由配置中的最佳实践
const routes = [
  {
    path: '/dashboard',
    component: DashboardView,
    meta: { keepAlive: true, cacheName: 'dashboard' } // 仪表板适合缓存
  },
  {
    path: '/profile',
    component: ProfileView,
    meta: { keepAlive: true, cacheName: 'profile' } // 个人资料适合缓存
  },
  {
    path: '/login',
    component: LoginView,
    meta: { keepAlive: false } // 登录页不适合缓存
  },
  {
    path: '/payment/:id',
    component: PaymentView,
    meta: { keepAlive: false } // 支付页不适合缓存
  }
]
```

### 2. 内存管理

```vue
<script setup lang="ts">
import { onUnmounted, onDeactivated } from 'vue'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

// 组件卸载时清理大对象
onUnmounted(() => {
  cleanupLargeData()
})

// 组件被缓存时清理不需要的数据
onDeactivated(() => {
  cleanupTemporaryData()
})

function cleanupLargeData() {
  // 清理大对象
}

function cleanupTemporaryData() {
  // 清理临时数据
}
</script>
```

### 3. 错误处理

```vue
<script setup lang="ts">
import { onErrorCaptured } from 'vue'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

// 捕获组件错误
onErrorCaptured((error, instance, info) => {
  console.error('组件错误:', error, info)
  
  // 如果是缓存相关错误，清除缓存
  if (error.message.includes('cache')) {
    manager.clearAllCache()
  }
  
  // 返回 false 阻止错误继续传播
  return false
})
</script>
```

## 调试技巧

### 1. 开启调试日志

```typescript
// 在开发环境中开启调试日志
if (import.meta.env.DEV) {
  console.log('当前缓存状态:', getCacheStatistics())
}
```

### 2. 缓存状态检查

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { getGlobalKeepAliveManager } from '@/utils/keepAliveManager'

const manager = getGlobalKeepAliveManager()

const isCached = computed(() => {
  return manager.cacheComponents.value.includes('CurrentComponentName')
})
</script>

<template>
  <div v-if="isCached" class="cache-indicator">
    🟢 页面已缓存
  </div>
</template>
```

这些示例展示了在实际项目中如何有效使用 keep-alive 功能，根据不同的应用场景选择合适的缓存策略。
