<script setup lang="ts">
import { ref, defineOptions } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'

defineOptions({
  name: 'LoginView'
})

const auth = useAuthStore()
const isRegister = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')

async function handleSubmit() {
  if (isRegister.value) {
    if (password.value !== confirmPassword.value) {
      auth.error = '两次密码不一致'
      return
    }
    await auth.register(username.value, password.value)
  } else {
    await auth.login(username.value, password.value)
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card glass-strong">
      <div class="brand">
        <span class="brand-icon">◆</span>
        <h1>ClaudeCode Remote</h1>
      </div>
      <form class="login-form" @submit.prevent="handleSubmit">
        <h2>{{ isRegister ? '注册账号' : '欢迎回来' }}</h2>
        <input
          v-model="username"
          class="glass-input"
          placeholder="用户名"
          required
          autocomplete="username"
        />
        <input
          v-model="password"
          class="glass-input"
          type="password"
          placeholder="密码"
          required
          autocomplete="current-password"
        />
        <input
          v-if="isRegister"
          v-model="confirmPassword"
          class="glass-input"
          type="password"
          placeholder="确认密码"
          required
        />
        <button
          type="submit"
          class="glass-button primary"
          :disabled="auth.isLoading"
        >
          {{ auth.isLoading ? '处理中...' : (isRegister ? '注册' : '登录') }}
        </button>
        <p v-if="auth.error" class="error">{{ auth.error }}</p>
        <p class="toggle">
          {{ isRegister ? '已有账号？' : '还没有账号？' }}
          <a href="#" @click.prevent="isRegister = !isRegister">
            {{ isRegister ? '登录' : '注册' }}
          </a>
        </p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-lg);
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: var(--space-2xl);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.brand-icon {
  font-size: 2.5rem;
  color: var(--color-accent);
}

.brand h1 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.login-form h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.02em;
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
  text-align: center;
}

.toggle {
  font-size: 0.875rem;
  text-align: center;
  color: var(--color-text-secondary);
}

.toggle a {
  font-weight: 500;
}
</style>
