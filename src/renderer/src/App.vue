<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useEngineStore } from './stores/useEngineStore'
import { useTaskStore } from './stores/useTaskStore'
import { useProjectStore } from './stores/useProjectStore'
import { useRoute, useRouter } from 'vue-router'
import { getGlobalKeepAliveManager } from './utils/keepAliveManager'
import FloatingButton from './components/FloatingButton.vue'

const engineStore = useEngineStore() // 确保引擎store全局初始化
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const route = useRoute()
const router = useRouter()
const isMobile = ref(false)

// 悬浮按钮点击事件处理
function handleFloatingButtonClick() {
  // 根据不同页面处理不同的逻辑
  if (route.path === '/tasks' || route.path.startsWith('/tasks/') || route.path.startsWith('/projects/')) {
    // 任务页面和项目详情页：打开创建任务面板
    window.dispatchEvent(new CustomEvent('open-task-create'))
  } else if (route.path === '/') {
    // 首页：跳转到任务页面
    router.push('/tasks')
  } else if (route.path === '/projects') {
    // 项目页面：跳转到第一个项目详情页
    const projectStore = useProjectStore()
    if (projectStore.projects.length > 0) {
      router.push(`/projects/${projectStore.projects[0]._id}`)
    }
  } else if (route.path === '/settings') {
    // 设置页面：可以打开设置相关的快捷功能
    // 这里暂时不做处理，可以根据需要添加
    console.log('设置页面悬浮按钮点击')
  } else {
    // 其他页面：默认行为
    console.log('悬浮按钮点击，当前页面：', route.path)
  }
}

// 初始化 keep-alive 管理器
const keepAliveManager = getGlobalKeepAliveManager()

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 启动自动缓存管理
  keepAliveManager.autoManageCache()

  // 启动引擎状态监听（SSE连接）
  engineStore.listen()
})

// 监听路由变化，动态更新缓存
watch(() => route.meta, (meta) => {
  const cacheName = meta.cacheName as string || route.name as string
  if (meta.keepAlive === false) {
    keepAliveManager.addToExclude(cacheName)
  }
}, { immediate: true })

const showMobileNav = computed(() => isMobile.value)
const showSidebar = computed(() => !isMobile.value)

// 计算需要缓存的组件
const include = computed(() => keepAliveManager.cacheComponents.value.join(','))
const exclude = computed(() => keepAliveManager.excludeComponents.value.join(','))
</script>

<template>
  <div class="app" :class="{ mobile: isMobile }">
      <aside v-if="showSidebar" class="sidebar glass">
        <div class="sidebar-brand">
          <span class="brand-icon">◆</span>
        </div>
        <nav>
          <RouterLink to="/" class="nav-item" title="首页">
            <span class="nav-icon">⌂</span>
            <span class="nav-label">首页</span>
          </RouterLink>
          <RouterLink to="/projects" class="nav-item" title="项目">
            <span class="nav-icon">▦</span>
            <span class="nav-label">项目</span>
          </RouterLink>
          <RouterLink to="/tasks" class="nav-item" title="任务">
            <span class="nav-icon">▤</span>
            <span class="nav-label">任务</span>
          </RouterLink>
          <RouterLink to="/settings" class="nav-item" title="设置">
            <span class="nav-icon">⚙</span>
            <span class="nav-label">设置</span>
          </RouterLink>
        </nav>
        <div class="user">
          <span class="username">User</span>
        </div>
      </aside>
      <main class="main">
        <RouterView v-slot="{ Component }">
          <template v-if="Component">
            <keep-alive :include="include" :exclude="exclude">
              <component :is="Component" :key="$route.fullPath" v-if="$route.meta.keepAlive !== false" />
            </keep-alive>
            <component :is="Component" :key="$route.fullPath" v-if="$route.meta.keepAlive === false" />
          </template>
        </RouterView>
      </main>
      <nav v-if="showMobileNav" class="mobile-nav glass">
        <RouterLink to="/" class="mobile-nav-item">
          <span class="mobile-icon">⌂</span>
          <span class="mobile-label">首页</span>
        </RouterLink>
        <RouterLink to="/projects" class="mobile-nav-item">
          <span class="mobile-icon">▦</span>
          <span class="mobile-label">项目</span>
        </RouterLink>
        <RouterLink to="/tasks" class="mobile-nav-item">
          <span class="mobile-icon">▤</span>
          <span class="mobile-label">任务</span>
        </RouterLink>
        <RouterLink to="/settings" class="mobile-nav-item">
          <span class="mobile-icon">⚙</span>
          <span class="mobile-label">设置</span>
        </RouterLink>
      </nav>

      <!-- 悬浮按钮 -->
      <FloatingButton @click="handleFloatingButtonClick" />
  </div>
</template>

<style>
.app {
  display: flex;
  min-height: 100vh;
}

/* ── 侧边栏玻璃 Dock ── */
.sidebar {
  position: fixed;
  left: 12px;
  top: 12px;
  bottom: 12px;
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-md) 0;
  z-index: 50;
  border-radius: var(--radius-xl);
}

.sidebar-brand {
  margin-bottom: var(--space-xl);
}

.brand-icon {
  font-size: 1.5rem;
  color: var(--color-accent);
}

.sidebar nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  flex: 1;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  color: var(--color-muted);
  text-decoration: none;
  transition: all var(--transition-fast);
  gap: 2px;
}

.nav-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

.nav-item.router-link-active {
  background: var(--glass-bg-strong);
  color: var(--color-accent);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
}

.nav-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.nav-label {
  font-size: 0.625rem;
  font-weight: 500;
}

.user {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  margin-top: auto;
  padding-top: var(--space-md);
  border-top: 1px solid var(--glass-border-subtle);
  width: 56px;
}

.username {
  font-size: 0.625rem;
  color: var(--color-muted);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 主内容区 ── */
.main {
  flex: 1;
  margin-left: 96px;
  padding: var(--space-2xl);
  overflow: auto;
  min-height: 100vh;
}

/* ── 移动端适配 ── */
.app.mobile {
  flex-direction: column;
  padding-bottom: 96px;
}

.app.mobile .main {
  margin-left: 0;
  padding: var(--space-lg);
}

.mobile-nav {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  height: 64px;
  padding: 0 var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  z-index: 100;
  border-radius: var(--radius-xl);
}

.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 52px;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-muted);
  font-size: 0.625rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  gap: 2px;
}

.mobile-nav-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

.mobile-nav-item.router-link-active {
  background: var(--glass-bg-strong);
  color: var(--color-accent);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
}

.mobile-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.mobile-label {
  font-size: 0.625rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .main {
    margin-left: 0;
    padding: var(--space-lg);
  }
}
</style>
