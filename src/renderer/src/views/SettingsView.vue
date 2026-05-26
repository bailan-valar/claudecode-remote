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
const isTestingConnection = ref(false)
const isExporting = ref(false)
const isImporting = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const requiresRestart = ref(false)
const testResult = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// 导入选项
const importOptions = ref({
  mergeMode: true,
  skipConflicts: false
})
const importResult = ref<any>(null)
const showImportOptions = ref(false)

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
    // Convert Vue proxy to plain object for IPC
    const plainConfig = JSON.parse(JSON.stringify(config.value))
    console.log('[settings] saving config:', plainConfig)
    const result = await apiClient.saveConfig(plainConfig)
    console.log('[settings] save result:', result)
    if (result.ok) {
      showMessage('success', '配置已保存，部分设置需要重启应用后生效')
      requiresRestart.value = true
    } else {
      showMessage('error', result.error || '保存配置失败')
    }
  } catch (err: any) {
    console.error('[settings] save error:', err)
    showMessage('error', err?.message || '保存配置失败')
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

async function testConnection() {
  isTestingConnection.value = true
  testResult.value = null
  try {
    const result = await apiClient.testCouchdbConnection({
      url: config.value.couchDbUrl || '',
      adminUser: config.value.couchDbAdminUser,
      adminPassword: config.value.couchDbAdminPassword,
    })
    if (result.ok) {
      testResult.value = { type: 'success', text: `✓ ${result.version}` }
    } else {
      testResult.value = { type: 'error', text: `✗ ${result.error || '连接失败'}` }
    }
  } catch {
    testResult.value = { type: 'error', text: '✗ 测试失败' }
  } finally {
    isTestingConnection.value = false
  }
}

// 导出数据
async function exportData() {
  isExporting.value = true
  try {
    const result = await apiClient.exportData()
    if (result.ok && result.data) {
      const dataStr = JSON.stringify(result.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `claudecode-backup-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showMessage('success', `已导出 ${result.data.projects.length} 个项目、${result.data.tasks.length} 个任务`)
    } else {
      showMessage('error', result.error || '导出失败')
    }
  } catch (err: any) {
    showMessage('error', err?.message || '导出失败')
  } finally {
    isExporting.value = false
  }
}

// 显示导入选项
function showImportDialog() {
  importResult.value = null
  showImportOptions.value = true
  const input = document.getElementById('import-file-input') as HTMLInputElement
  if (input) input.click()
}

// 导入数据
async function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isImporting.value = true
  importResult.value = null

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // 验证数据格式
    if (!data.version || !Array.isArray(data.projects) || !Array.isArray(data.tasks)) {
      throw new Error('无效的备份文件格式')
    }

    const result = await apiClient.importData(data, importOptions.value)

    if (result.ok && result.result) {
      importResult.value = result.result
      showMessage('success', `导入成功：${result.result.projectsCreated + result.result.projectsUpdated} 个项目，${result.result.tasksCreated + result.result.tasksUpdated} 个任务`)
    } else {
      showMessage('error', result.error || '导入失败')
    }
  } catch (err: any) {
    showMessage('error', err?.message || '导入失败')
  } finally {
    isImporting.value = false
    input.value = ''
  }
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
      <!-- CouchDB 连接配置已隐藏 -->
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

        <div class="test-row">
          <button
            class="glass-button secondary"
            :disabled="isTestingConnection"
            @click="testConnection"
          >
            {{ isTestingConnection ? '测试中...' : '测试连接' }}
          </button>
          <span v-if="testResult" class="test-result" :class="testResult.type">
            {{ testResult.text }}
          </span>
        </div>
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

      <!-- 数据导入导出 -->
      <section class="setting-section">
        <h2>数据管理</h2>
        <p class="section-desc">导出或导入您的项目、任务和聊天记录</p>

        <div class="data-actions">
          <button
            class="glass-button secondary"
            :disabled="isExporting"
            @click="exportData"
          >
            {{ isExporting ? '导出中...' : '导出数据' }}
          </button>

          <div class="import-group">
            <button
              class="glass-button secondary"
              :disabled="isImporting"
              @click="showImportDialog"
            >
              {{ isImporting ? '导入中...' : '导入数据' }}
            </button>
            <input
              id="import-file-input"
              type="file"
              accept=".json"
              style="display: none"
              @change="importData"
            />
          </div>
        </div>

        <!-- 导入选项 -->
        <div v-if="showImportOptions" class="import-options glass">
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="importOptions.mergeMode"
                type="checkbox"
              />
              <span>合并模式（保留现有数据）</span>
            </label>
            <span class="hint">取消勾选将清空现有数据后导入</span>
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input
                v-model="importOptions.skipConflicts"
                type="checkbox"
              />
              <span>跳过冲突</span>
            </label>
            <span class="hint">勾选后，ID 冲突的数据将被跳过而非覆盖</span>
          </div>
        </div>

        <!-- 导入结果 -->
        <div v-if="importResult" class="import-result glass">
          <h4>导入结果</h4>
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-label">项目：</span>
              <span class="stat-value">+{{ importResult.projectsCreated }} ~{{ importResult.projectsUpdated }} ⊘{{ importResult.projectsSkipped }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">任务：</span>
              <span class="stat-value">+{{ importResult.tasksCreated }} ~{{ importResult.tasksUpdated }} ⊘{{ importResult.tasksSkipped }}</span>
            </div>
            <div v-if="importResult.chatMessagesImported > 0" class="stat-item">
              <span class="stat-label">聊天记录：</span>
              <span class="stat-value">{{ importResult.chatMessagesImported }} 条</span>
            </div>
          </div>
          <div v-if="importResult.errors?.length > 0" class="result-errors">
            <details>
              <summary>查看错误 ({{ importResult.errors.length }})</summary>
              <ul>
                <li v-for="(error, i) in importResult.errors" :key="i">{{ error }}</li>
              </ul>
            </details>
          </div>
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

.setting-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
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

.test-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.test-result {
  font-size: 0.875rem;
}

.test-result.success {
  color: var(--color-success);
}

.test-result.error {
  color: var(--color-error);
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

/* Data Import/Export Styles */
.data-actions {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.import-group {
  position: relative;
}

.import-options {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.checkbox-group {
  margin-bottom: var(--space-md);
}

.checkbox-group:last-child {
  margin-bottom: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.875rem;
  color: var(--color-text);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.import-result {
  margin-top: var(--space-lg);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.stat-label {
  color: var(--color-muted);
}

.stat-value {
  color: var(--color-text);
  font-family: monospace;
}

.result-errors {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--glass-border-subtle);
}

.result-errors details {
  font-size: 0.875rem;
}

.result-errors summary {
  cursor: pointer;
  color: var(--color-error);
}

.result-errors ul {
  margin: var(--space-sm) 0 0 0;
  padding-left: var(--space-lg);
}

.result-errors li {
  color: var(--color-muted);
  margin-bottom: var(--space-xs);
}
</style>
