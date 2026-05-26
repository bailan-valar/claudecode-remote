<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'
import { apiClient } from '../api'
import type { Project, LlmProvider } from '../../../shared/types'

const props = defineProps<{
  initialProject?: Project
  mode?: 'create' | 'edit'
}>()
const emit = defineEmits<{
  submit: [changes?: Partial<Project>]
  cancel: []
}>()
const projectStore = useProjectStore()

const name = ref('')
const path = ref('')
const description = ref('')
const llmProviderId = ref<string>('')
const allowedTools = ref('Read,Edit,Bash')
const webhookUrl = ref('')
const webhookEnabled = ref(false)
const webhookNotifyOnFailure = ref(true)
const webhookMentionedList = ref('')
const siteUrl = ref('')
const webhookTesting = ref(false)
const webhookTestMessage = ref<{ ok: boolean; text: string } | null>(null)

// LLM Providers
const llmProviders = ref<LlmProvider[]>([])
const isLoadingProviders = ref(false)

const isEdit = computed(() => props.mode === 'edit')
const isElectron = typeof window !== 'undefined' && !!(window as any).api

// 当前选中的 Provider
const selectedProvider = computed(() => {
  return llmProviders.value.find(p => p.id === llmProviderId.value)
})

async function loadLlmProviders() {
  isLoadingProviders.value = true
  try {
    const result = await apiClient.listLlmProviders()
    if (result.ok) {
      llmProviders.value = result.providers || []
    }
  } finally {
    isLoadingProviders.value = false
  }
}

watch(() => props.initialProject, (p) => {
  if (p) {
    name.value = p.name
    path.value = p.path
    description.value = p.description ?? ''

    // 优先使用 llmProviderId，兼容旧的 llmConfig
    if (p.llmProviderId) {
      llmProviderId.value = p.llmProviderId
    } else if (p.llmConfig?.provider) {
      // 旧数据：尝试匹配对应的 provider
      const mapped = llmProviders.value.find(lp => lp.type === p.llmConfig?.provider)
      llmProviderId.value = mapped?.id || ''
    }

    allowedTools.value = p.allowedTools?.join(',') ?? 'Read,Edit,Bash'
    webhookUrl.value = p.webhookUrl ?? ''
    webhookEnabled.value = p.webhookEnabled ?? false
    webhookNotifyOnFailure.value = p.webhookNotifyOnFailure ?? true
    webhookMentionedList.value = p.webhookMentionedList?.join(',') ?? ''
    siteUrl.value = p.siteUrl ?? ''
  }
}, { immediate: true })

async function handleSelectDirectory() {
  const result = await apiClient.selectDirectory()
  if (result.ok && result.path) {
    path.value = result.path
  }
}

async function handleTestWebhook() {
  webhookTestMessage.value = null
  const url = webhookUrl.value.trim()
  if (!url) {
    webhookTestMessage.value = { ok: false, text: '请先填写 Webhook URL' }
    return
  }
  webhookTesting.value = true
  try {
    const result = await apiClient.testWebhook(url)
    if (result?.ok) {
      webhookTestMessage.value = { ok: true, text: '✅ 测试消息已发送，请在企业微信中查看' }
    } else {
      webhookTestMessage.value = { ok: false, text: `❌ 发送失败：${result?.error || '未知错误'}` }
    }
  } catch (err: any) {
    webhookTestMessage.value = { ok: false, text: `❌ 发送异常：${err.message || err}` }
  } finally {
    webhookTesting.value = false
  }
}

async function handleSubmit() {
  const tools = allowedTools.value.split(',').map(s => s.trim()).filter(Boolean)
  const mentioned = webhookMentionedList.value.split(',').map(s => s.trim()).filter(Boolean)

  if (isEdit.value) {
    const changes: Partial<Project> = {}
    if (name.value !== props.initialProject!.name) changes.name = name.value
    if (path.value !== props.initialProject!.path) changes.path = path.value
    if (description.value !== (props.initialProject!.description ?? '')) changes.description = description.value || undefined

    // 处理 LLM Provider 变更
    const oldProviderId = props.initialProject!.llmProviderId
    if (llmProviderId.value !== oldProviderId) {
      changes.llmProviderId = llmProviderId.value || undefined
    }

    const oldTools = props.initialProject!.allowedTools?.join(',') ?? 'Read,Edit,Bash'
    if (allowedTools.value !== oldTools) changes.allowedTools = tools
    if (webhookUrl.value !== (props.initialProject!.webhookUrl ?? '')) changes.webhookUrl = webhookUrl.value || undefined
    if (webhookEnabled.value !== (props.initialProject!.webhookEnabled ?? false)) changes.webhookEnabled = webhookEnabled.value
    if (webhookNotifyOnFailure.value !== (props.initialProject!.webhookNotifyOnFailure ?? true)) changes.webhookNotifyOnFailure = webhookNotifyOnFailure.value
    const oldMentioned = props.initialProject!.webhookMentionedList?.join(',') ?? ''
    if (webhookMentionedList.value !== oldMentioned) changes.webhookMentionedList = mentioned.length > 0 ? mentioned : undefined
    if (siteUrl.value !== (props.initialProject!.siteUrl ?? '')) changes.siteUrl = siteUrl.value || undefined
    emit('submit', changes)
    return
  }

  const result = await projectStore.create({
    name: name.value,
    path: path.value,
    description: description.value || undefined,
    llmProviderId: llmProviderId.value || undefined,
    allowedTools: tools,
    webhookUrl: webhookUrl.value || undefined,
    webhookEnabled: webhookEnabled.value,
    webhookNotifyOnFailure: webhookNotifyOnFailure.value,
    webhookMentionedList: mentioned.length > 0 ? mentioned : undefined,
    siteUrl: siteUrl.value || undefined,
  })
  if (result.ok) {
    name.value = ''
    path.value = ''
    description.value = ''
    llmProviderId.value = ''
    allowedTools.value = 'Read,Edit,Bash'
    webhookUrl.value = ''
    webhookEnabled.value = false
    webhookNotifyOnFailure.value = true
    webhookMentionedList.value = ''
    siteUrl.value = ''
    emit('submit')
  }
}

onMounted(() => {
  loadLlmProviders()
})
</script>

<template>
  <form class="project-form" @submit.prevent="handleSubmit">
    <input v-model="name" class="glass-input" placeholder="项目名称" required />
    <div class="path-input">
      <input v-model="path" class="glass-input" placeholder="本地路径" required :readonly="isElectron" />
      <button v-if="isElectron" type="button" class="glass-button" @click="handleSelectDirectory">选择文件夹</button>
    </div>
    <textarea v-model="description" class="glass-input" placeholder="描述（可选）" rows="2" />

    <fieldset class="llm-config glass">
      <legend>LLM 配置</legend>
      <div class="config-note">
        <p>选择该项目使用的大模型服务。留空则使用全局默认 Provider。</p>
      </div>

      <label>大模型服务 (LLM)</label>
      <select v-model="llmProviderId" class="glass-input" :disabled="isLoadingProviders">
        <option value="">使用全局默认</option>
        <option v-for="p in llmProviders" :key="p.id" :value="p.id">
          {{ p.name }}{{ p.isDefault ? ' (全局默认)' : '' }}
        </option>
      </select>

      <div v-if="selectedProvider" class="provider-info">
        <div class="info-item">
          <span class="info-label">类型</span>
          <span class="info-value">{{ selectedProvider.type }}</span>
        </div>
        <div v-if="selectedProvider.baseUrl" class="info-item">
          <span class="info-label">Base URL</span>
          <span class="info-value">{{ selectedProvider.baseUrl }}</span>
        </div>
        <div v-if="selectedProvider.model" class="info-item">
          <span class="info-label">模型</span>
          <span class="info-value">{{ selectedProvider.model }}</span>
        </div>
        <div v-if="selectedProvider.apiKey" class="info-item">
          <span class="info-label">API Key</span>
          <span class="info-value masked">{{ selectedProvider.apiKey.slice(0, 4) }}...{{ selectedProvider.apiKey.slice(-4) }}</span>
        </div>
      </div>

      <label>允许的工具</label>
      <input v-model="allowedTools" class="glass-input" placeholder="Read,Edit,Bash" />
    </fieldset>

    <fieldset class="webhook-config glass">
      <legend>企业微信通知</legend>
      <label class="toggle-label">
        <input v-model="webhookEnabled" type="checkbox" />
        <span>任务完成后推送通知</span>
      </label>

      <label>应用访问地址（用于通知中的任务链接）</label>
      <input
        v-model="siteUrl"
        class="glass-input"
        placeholder="如：http://192.168.1.100:3456 或 https://claude.example.com"
      />

      <label>Webhook URL</label>
      <div class="webhook-url-row">
        <input
          v-model="webhookUrl"
          class="glass-input"
          placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
          :disabled="!webhookEnabled"
        />
        <button
          type="button"
          class="glass-button"
          :disabled="!webhookEnabled || !webhookUrl || webhookTesting"
          @click="handleTestWebhook"
        >
          {{ webhookTesting ? '测试中...' : '发送测试' }}
        </button>
      </div>
      <p v-if="webhookTestMessage" class="test-result" :class="{ ok: webhookTestMessage.ok, err: !webhookTestMessage.ok }">
        {{ webhookTestMessage.text }}
      </p>

      <label class="toggle-label">
        <input v-model="webhookNotifyOnFailure" type="checkbox" :disabled="!webhookEnabled" />
        <span>任务失败时也发送通知</span>
      </label>

      <label>@提及成员（可选，逗号分隔的成员账号，@all 提及所有人）</label>
      <input
        v-model="webhookMentionedList"
        class="glass-input"
        placeholder="如：zhangsan,lisi 或 @all"
        :disabled="!webhookEnabled"
      />

      <p class="hint">在项目中的任务开发完成（进入待审核）时，向企业微信机器人推送 Markdown 消息。</p>
    </fieldset>

    <div class="actions">
      <button type="submit" class="glass-button primary">{{ isEdit ? '保存' : '创建' }}</button>
      <button type="button" class="glass-button" @click="emit('cancel')">取消</button>
    </div>
  </form>
</template>

<style scoped>
.project-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.path-input {
  display: flex;
  gap: var(--space-sm);
}

.path-input .glass-input {
  flex: 1;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.llm-config {
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  margin-top: var(--space-sm);
  border: 1px solid var(--glass-border-subtle);
}

.llm-config legend {
  font-weight: 600;
  padding: 0 var(--space-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
}

.config-note p {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin-bottom: var(--space-md);
  line-height: 1.4;
}

.llm-config label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-top: var(--space-md);
  margin-bottom: var(--space-xs);
  color: var(--color-text-secondary);
}

.llm-config .glass-input {
  margin-bottom: var(--space-xs);
}

.llm-config .glass-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.provider-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.05);
  border-radius: var(--radius-sm);
  margin-top: var(--space-xs);
}

.info-item {
  display: flex;
  gap: var(--space-xs);
  font-size: 0.8125rem;
}

.info-label {
  color: var(--color-muted);
  font-weight: 500;
}

.info-value {
  color: var(--color-text);
  font-family: monospace;
}

.info-value.masked {
  letter-spacing: 1px;
}

.webhook-config {
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  margin-top: var(--space-sm);
  border: 1px solid var(--glass-border-subtle);
}

.webhook-config legend {
  font-weight: 600;
  padding: 0 var(--space-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
}

.webhook-config label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-top: var(--space-md);
  margin-bottom: var(--space-xs);
  color: var(--color-text-secondary);
}

.webhook-config .glass-input {
  margin-bottom: var(--space-xs);
}

.webhook-config .glass-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.webhook-url-row {
  display: flex;
  gap: var(--space-sm);
  align-items: stretch;
}

.webhook-url-row .glass-input {
  flex: 1;
  margin-bottom: 0 !important;
}

.test-result {
  font-size: 0.8125rem;
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.test-result.ok {
  color: #2e7d32;
  background: rgba(76, 175, 80, 0.08);
}

.test-result.err {
  color: #c62828;
  background: rgba(244, 67, 54, 0.08);
}

.toggle-label {
  display: flex !important;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm) !important;
  cursor: pointer;
}

.toggle-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
  line-height: 1.4;
}
</style>
