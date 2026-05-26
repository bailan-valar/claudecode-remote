<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiClient } from '../api'
import type { AppConfig } from '../../../preload/index'

declare global {
  interface Window {
    location: Location
  }
}

defineOptions({
  name: 'SettingsView'
})

const config = ref<Partial<AppConfig>>({})
const isLoading = ref(false)
const isSaving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const requiresRestart = ref(false)

async function loadConfig() {
  isLoading.value = true
  try {
    const result = await apiClient.getConfig()
    if (result.ok) {
      config.value = result.config
    } else {
      showMessage('error', '加载配置失败')
    }
  } catch {
    showMessage('error', '加载配置失败')
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  isSaving.value = true
  try {
    const result = await apiClient.saveConfig(config.value)
    if (result.ok) {
      showMessage('success', '配置已保存，部分设置需要重启应用后生效')
      requiresRestart.value = true
    } else {
      showMessage('error', result.error || '保存配置失败')
    }
  } catch {
    showMessage('error', '保存配置失败')
  } finally {
    isSaving.value = false
  }
}

async function resetConfig() {
  if (!confirm('确定要重置所有配置为默认值吗？')) return
  isSaving.value = true
  try {
    const result = await apiClient.resetConfig()
    if (result.ok) {
      await loadConfig()
      showMessage('success', '配置已重置，请重启应用')
      requiresRestart.value = true
    } else {
      showMessage('error', result.error || '重置配置失败')
    }
  } catch {
    showMessage('error', '重置配置失败')
  } finally {
    isSaving.value = false
  }
}

function showMessage(type: 'success' | 'error', text: string) {
  message.value = { type, text }
  setTimeout(() => {
    message.value = null
  }, 5000)
}

function restartApp() {
  window.location.reload()
}

function testConnection() {
  const url = config.value.couchDbUrl || ''
  const hasAdmin = !!(config.value.couchDbAdminUser && config.value.couchDbAdminPassword)
  showMessage('success', `连接测试：${url} ${hasAdmin ? '(使用 Admin 认证)' : '(无需 Admin)'}`)
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>设置</h1>
      <p class="subtitle">配置应用选项</p>
    </div>

    <div v-if="isLoading" class="loading">加载中...</div>

    <div v-else class="settings-content glass-strong">
      <!-- CouchDB 连接配置已暂时隐藏 -->
      <!-- <section class="setting-section">
        <h2>CouchDB 连接</h2>
        <p class="section-desc">配置 CouchDB 服务器地址和认证信息</p>

        <div class="form-group">
          <label>CouchDB URL</label>
          <input
            v-model="config.couchDbUrl"
            type="url"
            class="glass-input"
            placeholder="http://localhost:5984"
          />
          <span class="hint">CouchDB 服务器地址（不含数据库名）</span>
        </div>

        <div class="form-group">
          <label>Admin 用户名（可选）</label>
          <input
            v-model="config.couchDbAdminUser"
            type="text"
            class="glass-input"
            placeholder="admin"
          />
          <span class="hint">用于创建用户数据库的管理员账号</span>
        </div>

        <div class="form-group">
          <label>Admin 密码（可选）</label>
          <input
            v-model="config.couchDbAdminPassword"
            type="password"
            class="glass-input"
            placeholder="••••••••"
          />
        </div>

        <button class="glass-button secondary" @click="testConnection">
          测试连接
        </button>
      </section> -->

      <section class="setting-section">
        <h2>Web 服务器</h2>
        <p class="section-desc">配置内置 Web 服务器端口</p>

        <div class="form-group">
          <label>端口</label>
          <input
            v-model.number="config.webPort"
            type="number"
            class="glass-input"
            placeholder="3456"
            min="1024"
            max="65535"
          />
          <span class="hint">手机端访问桌面端 UI 使用的端口</span>
        </div>
      </section>

      <div v-if="message" class="message" :class="message.type">
        {{ message.text }}
      </div>

      <div class="actions">
        <button
          class="glass-button primary"
          :disabled="isSaving"
          @click="saveConfig"
        >
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
        <button
          class="glass-button secondary"
          :disabled="isSaving"
          @click="resetConfig"
        >
          重置默认
        </button>
      </div>

      <div v-if="requiresRestart" class="restart-notice glass">
        <p>⚠️ 配置已更改，请重启应用使设置生效</p>
        <button class="glass-button small" @click="restartApp">
          立即重启
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.settings-header {
  margin-bottom: var(--space-2xl);
  text-align: center;
}

.settings-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.subtitle {
  color: var(--color-muted);
  font-size: 0.875rem;
}

.loading {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-muted);
}

.settings-content {
  padding: var(--space-2xl);
}

.setting-section {
  margin-bottom: var(--space-2xl);
  padding-bottom: var(--space-2xl);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.setting-section:last-of-type {
  border-bottom: none;
}

.setting-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.section-desc {
  color: var(--color-muted);
  font-size: 0.875rem;
  margin-bottom: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.form-group input {
  width: 100%;
}

.hint {
  display: block;
  font-size: 0.75rem;
  color: var(--color-muted);
  margin-top: var(--space-xs);
}

.message {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  text-align: center;
  margin-bottom: var(--space-lg);
}

.message.success {
  background: rgba(52, 199, 89, 0.1);
  color: var(--color-success);
}

.message.error {
  background: rgba(255, 59, 48, 0.1);
  color: var(--color-error);
}

.actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  margin-top: var(--space-2xl);
}

.restart-notice {
  margin-top: var(--space-xl);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  text-align: center;
}

.restart-notice p {
  font-size: 0.875rem;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}
</style>
