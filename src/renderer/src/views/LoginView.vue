<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'

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
    <h1>ClaudeCode Remote</h1>
    <form class="login-form" @submit.prevent="handleSubmit">
      <h2>{{ isRegister ? '注册' : '登录' }}</h2>
      <input v-model="username" placeholder="用户名" required autocomplete="username" />
      <input v-model="password" type="password" placeholder="密码" required autocomplete="current-password" />
      <input
        v-if="isRegister"
        v-model="confirmPassword"
        type="password"
        placeholder="确认密码"
        required
      />
      <button type="submit" :disabled="auth.isLoading">
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
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 300px;
}
.login-form input,
.login-form button {
  padding: 0.5rem;
  font-size: 1rem;
}
.error {
  color: #d32f2f;
  font-size: 0.875rem;
}
.toggle {
  font-size: 0.875rem;
  text-align: center;
}
</style>
