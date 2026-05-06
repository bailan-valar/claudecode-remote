import { defineStore } from 'pinia'
import { ref } from 'vue'

interface User {
  username: string
  roles: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function login(username: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const result = await window.api.login(username, password)
      if (result.ok) currentUser.value = result.user
      else error.value = result.error
    } finally {
      isLoading.value = false
    }
  }

  async function register(username: string, password: string) {
    isLoading.value = true
    error.value = null
    try {
      const result = await window.api.register(username, password)
      if (result.ok) {
        await login(username, password)
      } else {
        error.value = result.error
      }
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    await window.api.logout()
    currentUser.value = null
  }

  async function checkSession() {
    const result = await window.api.getSession()
    if (result.user) currentUser.value = result.user
  }

  return { currentUser, isLoading, error, login, register, logout, checkSession }
})
