<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'
import { apiClient } from '../api'
import type { Project } from '../../../shared/types'

type Provider = 'anthropic' | 'zhipu' | 'kimi'

const PRESET_URLS: Record<Provider, string> = {
  anthropic: '',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
}

const PRESET_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  zhipu: '',
  kimi: '',
}

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
const llmProvider = ref<Provider>('anthropic')
const llmBaseUrl = ref('')
const llmApiKey = ref('')
const llmModel = ref('')
const allowedTools = ref('Read,Edit,Bash')
const webhookUrl = ref('')
const webhookEnabled = ref(false)

const isEdit = computed(() => props.mode === 'edit')

watch(() => props.initialProject, (p) => {
  if (p) {
    name.value = p.name
    path.value = p.path
    description.value = p.description ?? ''
    llmProvider.value = p.llmConfig?.provider ?? 'anthropic'
    llmBaseUrl.value = p.llmConfig?.baseUrl ?? ''
    llmApiKey.value = p.llmConfig?.apiKey ?? ''
    llmModel.value = p.llmConfig?.model ?? ''
    allowedTools.value = p.allowedTools?.join(',') ?? 'Read,Edit,Bash'
    webhookUrl.value = p.webhookUrl ?? ''
    webhookEnabled.value = p.webhookEnabled ?? false
  }
}, { immediate: true })

watch(llmProvider, (provider) => {
  if (!isEdit.value || !props.initialProject?.llmConfig?.baseUrl) {
    llmBaseUrl.value = PRESET_URLS[provider]
  }
  if (!isEdit.value || !props.initialProject?.llmConfig?.model) {
    llmModel.value = PRESET_MODELS[provider]
  }
})

const isElectron = typeof window !== 'undefined' && !!(window as any).api

async function handleSelectDirectory() {
  const result = await apiClient.selectDirectory()
  if (result.ok && result.path) {
    path.value = result.path
  }
}

function buildLlmConfig() {
  return {
    provider: llmProvider.value,
    baseUrl: llmBaseUrl.value || undefined,
    apiKey: llmApiKey.value || undefined,
    model: llmModel.value || undefined,
  }
}

async function handleSubmit() {
  const tools = allowedTools.value.split(',').map(s => s.trim()).filter(Boolean)
  if (isEdit.value) {
    const changes: Partial<Project> = {}
    if (name.value !== props.initialProject!.name) changes.name = name.value
    if (path.value !== props.initialProject!.path) changes.path = path.value
    if (description.value !== (props.initialProject!.description ?? '')) changes.description = description.value || undefined
    const newLlm = buildLlmConfig()
    const oldLlm = props.initialProject!.llmConfig
    if (JSON.stringify(newLlm) !== JSON.stringify(oldLlm)) {
      changes.llmConfig = newLlm
    }
    const oldTools = props.initialProject!.allowedTools?.join(',') ?? 'Read,Edit,Bash'
    if (allowedTools.value !== oldTools) changes.allowedTools = tools
    if (webhookUrl.value !== (props.initialProject!.webhookUrl ?? '')) changes.webhookUrl = webhookUrl.value || undefined
    if (webhookEnabled.value !== (props.initialProject!.webhookEnabled ?? false)) changes.webhookEnabled = webhookEnabled.value
    emit('submit', changes)
    return
  }
  const result = await projectStore.create({
    name: name.value,
    path: path.value,
    description: description.value || undefined,
    llmConfig: buildLlmConfig(),
    allowedTools: tools,
    webhookUrl: webhookUrl.value || undefined,
    webhookEnabled: webhookEnabled.value,
  })
  if (result.ok) {
    name.value = ''
    path.value = ''
    description.value = ''
    llmProvider.value = 'anthropic'
    llmBaseUrl.value = ''
    llmApiKey.value = ''
    llmModel.value = ''
    allowedTools.value = 'Read,Edit,Bash'
    webhookUrl.value = ''
    webhookEnabled.value = false
    emit('submit')
  }
}
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
      <label>Provider</label>
      <select v-model="llmProvider" class="glass-input">
        <option value="anthropic">Anthropic 官方</option>
        <option value="zhipu">智谱 GLM</option>
        <option value="kimi">Kimi K2</option>
      </select>

      <label>Base URL</label>
      <input v-model="llmBaseUrl" class="glass-input" placeholder="可选，留空使用默认" />

      <label>API Key</label>
      <input v-model="llmApiKey" class="glass-input" type="password" placeholder="可选" />

      <label>模型名称</label>
      <input v-model="llmModel" class="glass-input" placeholder="可选" />

      <label>允许的工具</label>
      <input v-model="allowedTools" class="glass-input" placeholder="Read,Edit,Bash" />
    </fieldset>

    <fieldset class="webhook-config glass">
      <legend>企业微信通知</legend>
      <label class="toggle-label">
        <input v-model="webhookEnabled" type="checkbox" />
        <span>任务完成后推送通知</span>
      </label>

      <label>Webhook URL</label>
      <input
        v-model="webhookUrl"
        class="glass-input"
        placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
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
