<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/useAuthStore'

const auth = useAuthStore()
onMounted(() => auth.checkSession())
</script>

<template>
  <div class="app">
    <template v-if="auth.currentUser">
      <aside class="sidebar">
        <nav>
          <RouterLink to="/">首页</RouterLink>
          <RouterLink to="/projects">项目</RouterLink>
          <RouterLink to="/tasks">任务</RouterLink>
        </nav>
        <div class="user">
          <span>{{ auth.currentUser.username }}</span>
          <button @click="auth.logout()">注销</button>
        </div>
      </aside>
      <main class="main">
        <RouterView />
      </main>
    </template>
    <template v-else>
      <RouterView />
    </template>
  </div>
</template>

<style>
.app { display: flex; min-height: 100vh; }
.sidebar { width: 200px; background: #f5f5f5; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; }
.sidebar nav { display: flex; flex-direction: column; gap: 0.5rem; }
.sidebar a { text-decoration: none; color: #333; padding: 0.5rem; border-radius: 4px; }
.sidebar a:hover, .sidebar a.router-link-active { background: #e0e0e0; }
.user { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; }
.main { flex: 1; padding: 1rem; overflow: auto; }
</style>
