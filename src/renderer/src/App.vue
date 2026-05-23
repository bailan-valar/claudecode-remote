<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from './stores/useAuthStore'

const auth = useAuthStore()
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  auth.checkSession()
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

const showMobileNav = computed(() => auth.currentUser && isMobile.value)
const showSidebar = computed(() => auth.currentUser && !isMobile.value)
</script>

<template>
  <div class="app" :class="{ mobile: isMobile }">
    <template v-if="auth.currentUser">
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
            <span class="nav-icon">◈</span>
            <span class="nav-label">项目</span>
          </RouterLink>
          <RouterLink to="/tasks" class="nav-item" title="任务">
            <span class="nav-icon">▤</span>
            <span class="nav-label">任务</span>
          </RouterLink>
        </nav>
        <div class="user">
          <span class="username">{{ auth.currentUser.username }}</span>
          <button class="logout-btn" @click="auth.logout()" title="注销">
            <span class="nav-icon">⎋</span>
          </button>
        </div>
      </aside>
      <main class="main">
        <RouterView v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="$route.path" v-if="$route.meta.keepAlive !== false" />
          </keep-alive>
          <component :is="Component" :key="$route.path" v-if="$route.meta.keepAlive === false" />
        </RouterView>
      </main>
      <nav v-if="showMobileNav" class="mobile-nav glass">
        <RouterLink to="/" class="mobile-nav-item">
          <span class="mobile-icon">⌂</span>
          <span class="mobile-label">首页</span>
        </RouterLink>
        <RouterLink to="/projects" class="mobile-nav-item">
          <span class="mobile-icon">◈</span>
          <span class="mobile-label">项目</span>
        </RouterLink>
        <RouterLink to="/tasks" class="mobile-nav-item">
          <span class="mobile-icon">▤</span>
          <span class="mobile-label">任务</span>
        </RouterLink>
        <button class="mobile-nav-item logout" @click="auth.logout()">
          <span class="mobile-icon">⎋</span>
          <span class="mobile-label">注销</span>
        </button>
      </nav>
    </template>
    <template v-else>
      <RouterView v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" :key="$route.path" v-if="$route.meta.keepAlive !== false" />
        </keep-alive>
        <component :is="Component" :key="$route.path" v-if="$route.meta.keepAlive === false" />
      </RouterView>
    </template>
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

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-muted);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.logout-btn:hover {
  background: rgba(255, 59, 48, 0.1);
  color: var(--color-error);
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

.mobile-nav-item,
.mobile-nav .logout {
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

.mobile-nav-item.logout:hover {
  background: rgba(255, 59, 48, 0.1);
  color: var(--color-error);
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
