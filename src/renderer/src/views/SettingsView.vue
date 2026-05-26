<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiClient } from '../api'
import type { AppConfig, LlmProvider } from '../../../preload/index'

declare global {
  interface Window {
    location: Location
  }
}

defineOptions({
  name: 'SettingsView'
})

// 当前选中的设置类别
const activeTab = ref<'general' | 'llm' | 'data'>('general')

// 设置类别定义
const settingCategories = [
  { id: 'general' as const, name: '通用设置', icon: '⚙️' },
  { id: 'llm' as const, name: 'LLM 配置', icon: '🤖' },
  { id: 'data' as const, name: '数据管理', icon: '📦' },
]

// === LLM Providers ===
const providers = ref<LlmProvider[]>([])
const isLoadingProviders = ref(false)
const editingProvider = ref<Partial<LlmProvider> | null>(null)
const showProviderForm = ref(false)
const testingProvider = ref<string | null>(null)
const testResult = ref<{ providerId: string; ok: boolean; text: string } | null>(null)
const deleteConfirm = ref<string | null>(null)

const config = ref<Partial<AppConfig>>({})
const isLoading = ref(false)
const isSaving = ref(false)
const isTestingConnection = ref(false)
const isExporting = ref(false)
const isImporting = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const requiresRestart = ref(false)
const connectionTestResult = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// 实例信息
const instanceInfo = ref<{ instanceId: string; localDbName: string } | null>(null)

// 导入选项
const importOptions = ref({
  mergeMode: true,
  skipConflicts: false
})
const importResult = ref<any>(null)

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

async function loadInstanceInfo() {
  try {
    const result = await apiClient.getInstanceInfo()
    if (result.ok) {
      instanceInfo.value = {
        instanceId: result.instanceId,
        localDbName: result.localDbName
      }
    }
  } catch {
    // ignore
  }
}

async function saveConfig() {
  isSaving.value = true
  try {
    // Convert Vue proxy to plain object for IPC
    const plainConfig = JSON.parse(JSON.stringify(config.value))
    const result = await apiClient.saveConfig(plainConfig)
    if (result.ok) {
      showMessage('success', '配置已保存，部分设置需要重启应用后生效')
      requiresRestart.value = true
    } else {
      showMessage('error', result.error || '保存配置失败')
    }
  } catch (err: any) {
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
  connectionTestResult.value = null
  try {
    const result = await apiClient.testCouchdbConnection({
      url: config.value.couchDbUrl || '',
      adminUser: config.value.couchDbAdminUser,
      adminPassword: config.value.couchDbAdminPassword,
    })
    if (result.ok) {
      connectionTestResult.value = { type: 'success', text: `✓ ${result.version}` }
    } else {
      connectionTestResult.value = { type: 'error', text: `✗ ${result.error || '连接失败'}` }
    }
  } catch {
    connectionTestResult.value = { type: 'error', text: '✗ 测试失败' }
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

    // 将 Vue Proxy 转换为普通对象，确保可序列化
    const plainData = JSON.parse(JSON.stringify(data))
    const plainOptions = JSON.parse(JSON.stringify(importOptions.value))

    const result = await apiClient.importData(plainData, plainOptions)

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
  loadInstanceInfo()
  loadProviders()
})

// === LLM Providers 管理 ===
async function loadProviders() {
  isLoadingProviders.value = true
  try {
    const result = await apiClient.listLlmProviders()
    if (result.ok) {
      providers.value = result.providers || []
    }
  } catch {
    // ignore
  } finally {
    isLoadingProviders.value = false
  }
}

function openAddProvider() {
  editingProvider.value = {
    name: '',
    type: 'anthropic',
    isDefault: false,
  }
  showProviderForm.value = true
  testResult.value = null
}

function openEditProvider(provider: LlmProvider) {
  editingProvider.value = { ...provider }
  showProviderForm.value = true
  testResult.value = null
}

function closeProviderForm() {
  showProviderForm.value = false
  editingProvider.value = null
  testResult.value = null
}

async function saveProvider() {
  if (!editingProvider.value) return

  const isNew = !editingProvider.value.id
  const data = {
    name: editingProvider.value.name!,
    type: editingProvider.value.type!,
    baseUrl: editingProvider.value.baseUrl,
    apiKey: editingProvider.value.apiKey,
    model: editingProvider.value.model,
    isDefault: editingProvider.value.isDefault || false,
  }

  try {
    let result
    if (isNew) {
      result = await apiClient.addLlmProvider(data)
      if (result.ok) {
        showMessage('success', 'Provider 已添加')
        providers.value.push(result.provider)
      } else {
        showMessage('error', result.error || '添加失败')
        return
      }
    } else {
      result = await apiClient.updateLlmProvider(editingProvider.value.id!, data)
      if (result.ok) {
        showMessage('success', 'Provider 已更新')
        const idx = providers.value.findIndex(p => p.id === editingProvider.value!.id)
        if (idx !== -1) providers.value[idx] = result.provider
      } else {
        showMessage('error', result.error || '更新失败')
        return
      }
    }
    closeProviderForm()
  } catch (err: any) {
    showMessage('error', err?.message || '操作失败')
  }
}

async function setAsDefault(id: string) {
  try {
    const result = await apiClient.setDefaultLlmProvider(id)
    if (result.ok) {
      providers.value.forEach(p => p.isDefault = (p.id === id))
      showMessage('success', '默认 Provider 已更新')
    } else {
      showMessage('error', result.error || '操作失败')
    }
  } catch (err: any) {
    showMessage('error', err?.message || '操作失败')
  }
}

function confirmDelete(id: string) {
  deleteConfirm.value = id
}

async function deleteProvider(id: string) {
  try {
    const result = await apiClient.deleteLlmProvider(id)
    if (result.ok) {
      providers.value = providers.value.filter(p => p.id !== id)
      showMessage('success', 'Provider 已删除')
    } else {
      showMessage('error', result.error || '删除失败')
    }
  } catch (err: any) {
    showMessage('error', err?.message || '删除失败')
  } finally {
    deleteConfirm.value = null
  }
}

const providerTypes = [
  { value: 'anthropic', label: 'Anthropic', defaultBaseUrl: '', defaultModel: 'claude-sonnet-4-20250514' },
]

function onProviderTypeChange() {
  if (!editingProvider.value) return
  const type = providerTypes.find(t => t.value === editingProvider.value!.type)
  if (type && !editingProvider.value.baseUrl) {
    editingProvider.value.baseUrl = type.defaultBaseUrl
  }
}

function getTypeLabel(type: string): string {
  return providerTypes.find(t => t.value === type)?.label || type
}

function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '•'.repeat(key.length)
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 8)) + key.slice(-4)
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>设置</h1>
      <p class="subtitle">配置应用选项</p>
    </div>

    <div v-if="isLoading" class="loading">加载中...</div>

    <div v-else class="settings-container">
      <!-- 侧边栏导航 -->
      <nav class="settings-nav glass">
        <h3 class="nav-title">设置类别</h3>
        <div class="nav-items">
          <button
            v-for="category in settingCategories"
            :key="category.id"
            class="nav-item"
            :class="{ active: activeTab === category.id }"
            @click="activeTab = category.id"
          >
            <span class="nav-icon">{{ category.icon }}</span>
            <span class="nav-name">{{ category.name }}</span>
          </button>
        </div>
      </nav>

      <!-- 设置内容区 -->
      <main class="settings-main">
        <!-- 通用设置 -->
        <section v-show="activeTab === 'general'" class="settings-content glass-strong">
          <div class="content-header">
            <h2>通用设置</h2>
            <p class="section-desc">配置应用基本选项</p>
          </div>

          <div class="form-section">
            <h3>Web 服务器</h3>
            <p class="field-desc">配置内置 Web 服务器端口，用于手机端访问</p>

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
          </div>

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
        </section>

        <!-- LLM Providers -->
        <section v-show="activeTab === 'llm'" class="settings-content glass-strong">
          <div class="content-header">
            <h2>LLM 配置</h2>
            <p class="section-desc">管理大模型服务提供商（Claude Code、Kimi Code 等执行引擎使用）</p>
          </div>

          <!-- Provider 列表 -->
          <div v-if="!showProviderForm" class="providers-list">
            <div v-if="isLoadingProviders" class="loading">加载中...</div>

            <div v-else class="provider-cards">
              <div
                v-for="provider in providers"
                :key="provider.id"
                class="provider-card glass"
                :class="{ default: provider.isDefault }"
              >
                <div class="provider-header">
                  <div class="provider-info">
                    <span class="provider-type-badge">{{ getTypeLabel(provider.type) }}</span>
                    <h3>{{ provider.name }}</h3>
                    <span v-if="provider.isDefault" class="default-badge">默认</span>
                  </div>
                  <div class="provider-actions">
                    <button
                      v-if="!provider.isDefault"
                      class="glass-button small"
                      @click="setAsDefault(provider.id)"
                    >
                      设为默认
                    </button>
                    <button class="glass-button small" @click="openEditProvider(provider)">
                      编辑
                    </button>
                    <button
                      class="glass-button small danger"
                      @click="confirmDelete(provider.id)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div class="provider-details">
                  <div v-if="provider.baseUrl" class="detail-item">
                    <span class="detail-label">Base URL</span>
                    <span class="detail-value">{{ provider.baseUrl }}</span>
                  </div>
                  <div v-if="provider.model" class="detail-item">
                    <span class="detail-label">模型</span>
                    <span class="detail-value">{{ provider.model }}</span>
                  </div>
                  <div v-if="provider.apiKey" class="detail-item">
                    <span class="detail-label">API Key</span>
                    <span class="detail-value masked">{{ maskApiKey(provider.apiKey) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="add-provider-section">
              <button class="glass-button primary" @click="openAddProvider">
                + 添加 Provider
              </button>
            </div>
          </div>

          <!-- Provider 表单 -->
          <div v-if="showProviderForm && editingProvider" class="provider-form glass">
            <div class="form-header">
              <h3>{{ editingProvider?.id ? '编辑 Provider' : '添加 Provider' }}</h3>
              <button class="glass-button small" @click="closeProviderForm">取消</button>
            </div>

            <div class="form-group">
              <label>名称</label>
              <input
                v-model="editingProvider.name"
                class="glass-input"
                placeholder="如：Anthropic 官方"
                required
              />
            </div>

            <div class="form-group">
              <label>类型</label>
              <select v-model="editingProvider.type" class="glass-input" @change="onProviderTypeChange">
                <option v-for="type in providerTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Base URL</label>
              <input
                v-model="editingProvider.baseUrl"
                class="glass-input"
                placeholder="API 端点地址（可选）"
              />
            </div>

            <div class="form-group">
              <label>API Key</label>
              <input
                v-model="editingProvider.apiKey"
                type="password"
                class="glass-input"
                placeholder="API 密钥（可选）"
              />
            </div>

            <div class="form-group">
              <label>模型名称</label>
              <input
                v-model="editingProvider.model"
                class="glass-input"
                placeholder="模型标识（可选）"
              />
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input v-model="editingProvider.isDefault" type="checkbox" />
                <span>设为默认 Provider</span>
              </label>
            </div>

            <div class="form-actions">
              <button class="glass-button primary" @click="saveProvider">
                {{ editingProvider?.id ? '保存' : '添加' }}
              </button>
              <button class="glass-button" @click="closeProviderForm">取消</button>
            </div>
          </div>

          <!-- 删除确认对话框 -->
          <div v-if="deleteConfirm" class="modal-overlay" @click.self="deleteConfirm = null">
            <div class="modal glass-strong">
              <h3>确认删除</h3>
              <p>确定要删除这个 Provider 吗？此操作无法撤销。</p>
              <div class="modal-actions">
                <button class="glass-button danger" @click="deleteProvider(deleteConfirm)">
                  删除
                </button>
                <button class="glass-button" @click="deleteConfirm = null">
                  取消
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 数据管理 -->
        <section v-show="activeTab === 'data'" class="settings-content glass-strong">
          <div class="content-header">
            <h2>数据管理</h2>
            <p class="section-desc">导出或导入您的项目、任务和聊天记录</p>
          </div>

          <!-- 实例信息 -->
          <div v-if="instanceInfo" class="instance-info glass">
            <div class="info-item">
              <span class="info-label">实例 ID</span>
              <span class="info-value">{{ instanceInfo.instanceId.slice(0, 8) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">数据库名称</span>
              <span class="info-value">{{ instanceInfo.localDbName }}</span>
            </div>
          </div>

          <div class="data-section">
            <!-- 导入导出操作 -->
            <div class="action-cards">
              <div class="action-card glass">
                <div class="card-icon">📤</div>
                <div class="card-content">
                  <h4>导出数据</h4>
                  <p>将所有数据导出为备份文件</p>
                  <button
                    class="glass-button primary"
                    :disabled="isExporting"
                    @click="exportData"
                  >
                    {{ isExporting ? '导出中...' : '开始导出' }}
                  </button>
                </div>
              </div>

              <div class="action-card glass">
                <div class="card-icon">📥</div>
                <div class="card-content">
                  <h4>导入数据</h4>
                  <p>从备份文件恢复数据</p>
                  <button
                    class="glass-button primary"
                    :disabled="isImporting"
                    @click="showImportDialog"
                  >
                    {{ isImporting ? '导入中...' : '选择文件' }}
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
            </div>

            <!-- 导入选项 -->
            <div v-if="isImporting || importResult" class="import-panel glass">
              <div v-if="isImporting && !importResult" class="import-progress">
                <div class="progress-spinner"></div>
                <p>正在导入数据，请稍候...</p>
              </div>

              <div v-if="importResult" class="import-result-panel">
                <div class="result-header">
                  <h4>{{ importResult.errors?.length > 0 ? '导入完成（有错误）' : '导入成功' }}</h4>
                  <span class="result-status" :class="{ success: !importResult.errors?.length, warning: importResult.errors?.length > 0 }">
                    {{ importResult.errors?.length > 0 ? '部分成功' : '完成' }}
                  </span>
                </div>

                <!-- 结果统计 -->
                <div class="result-summary">
                  <div class="summary-card">
                    <span class="summary-label">项目</span>
                    <div class="summary-stats">
                      <span class="stat created">+{{ importResult.projectsCreated }}</span>
                      <span class="stat updated">~{{ importResult.projectsUpdated }}</span>
                      <span v-if="importResult.projectsSkipped > 0" class="stat skipped">⊘{{ importResult.projectsSkipped }}</span>
                    </div>
                  </div>

                  <div class="summary-card">
                    <span class="summary-label">任务</span>
                    <div class="summary-stats">
                      <span class="stat created">+{{ importResult.tasksCreated }}</span>
                      <span class="stat updated">~{{ importResult.tasksUpdated }}</span>
                      <span v-if="importResult.tasksSkipped > 0" class="stat skipped">⊘{{ importResult.tasksSkipped }}</span>
                    </div>
                  </div>

                  <div v-if="importResult.chatMessagesImported > 0" class="summary-card">
                    <span class="summary-label">聊天记录</span>
                    <span class="summary-value">{{ importResult.chatMessagesImported }} 条</span>
                  </div>
                </div>

                <!-- 错误列表 -->
                <div v-if="importResult.errors?.length > 0" class="errors-panel">
                  <details>
                    <summary>
                      <span class="errors-count">{{ importResult.errors.length }}</span>
                      个错误需要关注
                    </summary>
                    <div class="errors-list">
                      <div v-for="(error, i) in importResult.errors" :key="i" class="error-item">
                        <span class="error-icon">⚠️</span>
                        <span class="error-text">{{ error }}</span>
                      </div>
                    </div>
                  </details>
                </div>

                <!-- 关闭按钮 -->
                <button class="glass-button secondary full-width" @click="importResult = null">
                  关闭
                </button>
              </div>
            </div>

            <!-- 导入选项设置 -->
            <div v-if="!isImporting && !importResult" class="import-options-panel glass">
              <h4>导入选项</h4>
              <div class="options-grid">
                <label class="option-item">
                  <input
                    v-model="importOptions.mergeMode"
                    type="checkbox"
                  />
                  <div class="option-content">
                    <span class="option-name">合并模式</span>
                    <span class="option-desc">保留现有数据，与新数据合并</span>
                  </div>
                </label>

                <label class="option-item">
                  <input
                    v-model="importOptions.skipConflicts"
                    type="checkbox"
                  />
                  <div class="option-content">
                    <span class="option-name">跳过冲突</span>
                    <span class="option-desc">ID 冲突时跳过而非覆盖</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- 提示信息 -->
            <div v-if="message" class="message" :class="message.type">
              {{ message.text }}
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-md);
}

.settings-header {
  margin-bottom: var(--space-lg);
  text-align: center;
}

.settings-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
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

/* 容器布局 */
.settings-container {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: var(--space-lg);
  align-items: start;
}

/* 侧边栏导航 */
.settings-nav {
  position: sticky;
  top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
}

.nav-title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  margin-bottom: var(--space-sm);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.nav-item.active {
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.15);
  color: rgb(var(--color-primary-rgb, 99, 102, 241));
}

.nav-icon {
  font-size: 1rem;
  line-height: 1;
}

/* 主内容区 */
.settings-main {
  min-height: 400px;
}

.settings-content {
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
}

.content-header {
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.content-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.section-desc {
  color: var(--color-muted);
  font-size: 0.9375rem;
}

.field-desc {
  color: var(--color-muted);
  font-size: 0.875rem;
  margin-bottom: var(--space-md);
}

/* 表单区域 */
.form-section {
  margin-bottom: var(--space-lg);
}

.form-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.form-group {
  margin-bottom: var(--space-md);
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

/* 实例信息 */
.instance-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.info-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.info-label {
  font-size: 0.75rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.875rem;
  font-family: monospace;
  color: var(--color-text);
  background: var(--glass-bg-subtle);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 数据管理区域 */
.data-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* 操作卡片 */
.action-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-sm);
}

.action-card {
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  display: flex;
  align-items: start;
  gap: var(--space-sm);
}

.card-icon {
  font-size: 2rem;
  line-height: 1;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.card-content h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.card-content p {
  font-size: 0.875rem;
  color: var(--color-muted);
  margin: 0;
}

/* 导入结果面板 */
.import-panel {
  padding: var(--space-lg);
  border-radius: var(--radius-md);
}

.import-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  text-align: center;
}

.progress-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--glass-border-subtle);
  border-top-color: rgb(var(--color-primary-rgb, 99, 102, 241));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.import-result-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.result-status {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.result-status.success {
  background: rgba(52, 199, 89, 0.15);
  color: var(--color-success);
}

.result-status.warning {
  background: rgba(255, 159, 10, 0.15);
  color: rgb(255, 159, 10);
}

/* 结果摘要 */
.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-sm);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
}

.summary-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.stat {
  font-size: 0.875rem;
  font-weight: 500;
}

.stat.created {
  color: var(--color-success);
}

.stat.updated {
  color: rgb(var(--color-primary-rgb, 99, 102, 241));
}

.stat.skipped {
  color: var(--color-muted);
}

.summary-value {
  font-size: 0.875rem;
  color: var(--color-text);
}

/* 错误面板 */
.errors-panel {
  padding: var(--space-sm);
  background: rgba(255, 59, 48, 0.08);
  border-radius: var(--radius-md);
}

.errors-panel details {
  font-size: 0.875rem;
}

.errors-panel summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  color: var(--color-error);
  font-weight: 500;
  list-style: none;
}

.errors-panel summary::-webkit-details-marker {
  display: none;
}

.errors-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 0 var(--space-xs);
  background: rgba(255, 59, 48, 0.2);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.errors-list {
  margin-top: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.error-item {
  display: flex;
  align-items: start;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
}

.error-icon {
  font-size: 0.875rem;
  line-height: 1.4;
}

.error-text {
  flex: 1;
  color: var(--color-muted);
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* 导入选项面板 */
.import-options-panel {
  padding: var(--space-md);
  border-radius: var(--radius-md);
}

.import-options-panel h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.option-item {
  display: flex;
  align-items: start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s ease;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.option-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  cursor: pointer;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.option-desc {
  font-size: 0.75rem;
  color: var(--color-muted);
}

/* 通用样式 */
.message {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  text-align: center;
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

.full-width {
  width: 100%;
}

/* LLM Providers 样式 */
.providers-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.provider-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.provider-card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border-subtle);
  transition: border-color 0.2s ease;
}

.provider-card.default {
  border-color: rgb(var(--color-primary-rgb, 99, 102, 241));
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.05);
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: var(--space-sm);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.provider-type-badge {
  padding: 2px 8px;
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.15);
  color: rgb(var(--color-primary-rgb, 99, 102, 241));
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.provider-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.default-badge {
  padding: 2px 8px;
  background: var(--color-success);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.provider-actions {
  display: flex;
  gap: var(--space-xs);
}

.provider-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--glass-border-subtle);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.detail-label {
  color: var(--color-muted);
  font-weight: 500;
}

.detail-value {
  color: var(--color-text);
  font-family: monospace;
  font-size: 0.8125rem;
  word-break: break-all;
}

.detail-value.masked {
  letter-spacing: 2px;
}

.add-provider-section {
  display: flex;
  justify-content: center;
  padding-top: var(--space-md);
}

/* Provider 表单 */
.provider-form {
  padding: var(--space-lg);
  border-radius: var(--radius-md);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.form-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.checkbox-group {
  margin-top: var(--space-md);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  margin-top: var(--space-lg);
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  padding: var(--space-md);
}

.modal {
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  max-width: 400px;
  width: 100%;
}

.modal h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--space-sm) 0;
}

.modal p {
  color: var(--color-muted);
  margin: 0 0 var(--space-lg) 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

/* 响应式 */
@media (max-width: 768px) {
  .settings-container {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    position: static;
  }

  .nav-items {
    flex-direction: row;
    overflow-x: auto;
  }

  .nav-item {
    white-space: nowrap;
  }
}
</style>
