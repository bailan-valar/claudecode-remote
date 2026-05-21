<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import ProjectForm from '../components/ProjectForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import type { Project } from '../../../shared/types'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const taskStore = useTaskStore()

const projectId = route.params.id as string
const project = ref<Project | undefined>()
const isEditing = ref(false)
const showDeleteConfirm = ref(false)

onMounted(() => {
  project.value = projectStore.projects.find((p) => p._id === projectId)
  if (!project.value) projectStore.fetch()
  taskStore.fetch(projectId)
})

watch(
  () => projectStore.projects,
  (list) => {
    project.value = list.find((p) => p._id === projectId)
  },
  { immediate: true },
)

async function handleUpdate(changes?: Partial<Project>) {
  if (!project.value || !changes) return
  const result = await projectStore.update(project.value._id, changes)
  if (result.ok) {
    project.value = result.project
    isEditing.value = false
  }
}

async function handleDelete() {
  const result = await projectStore.remove(projectId)
  if (result.ok) router.push({ name: 'projects' })
}
</script>

<template>
  <div v-if="!project" class="loading">加载中...</div>
  <div v-else class="project-detail">
    <header>
      <h1 v-if="!isEditing" class="page-title">{{ project.name }}</h1>
      <div class="actions">
        <button v-if="!isEditing" class="glass-button" @click="isEditing = true">编辑</button>
        <button v-else class="glass-button" @click="isEditing = false">取消编辑</button>
        <button class="glass-button danger" @click="showDeleteConfirm = true">删除</button>
      </div>
    </header>

    <div v-if="isEditing" class="form-panel glass">
      <ProjectForm
        :initial-project="project"
        mode="edit"
        @submit="handleUpdate"
        @cancel="isEditing = false"
      />
    </div>

    <section v-else class="info glass">
      <div class="info-row">
        <span class="info-label">路径</span>
        <span class="info-value mono">{{ project.path }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">描述</span>
        <span class="info-value">{{ project.description || '无' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">允许的工具</span>
        <span class="info-value">{{ project.allowedTools?.join(', ') ?? 'Read, Edit, Bash' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">LLM Provider</span>
        <span class="info-value">{{ project.llmConfig?.provider ?? 'Anthropic 官方' }}</span>
      </div>
      <div v-if="project.llmConfig?.baseUrl" class="info-row">
        <span class="info-label">Base URL</span>
        <span class="info-value mono">{{ project.llmConfig.baseUrl }}</span>
      </div>
      <div v-if="project.llmConfig?.model" class="info-row">
        <span class="info-label">模型</span>
        <span class="info-value mono">{{ project.llmConfig.model }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">创建时间</span>
        <span class="info-value">{{ new Date(project.createdAt).toLocaleString() }}</span>
      </div>
    </section>

    <section class="tasks">
      <h2 class="section-title">关联任务（{{ taskStore.filteredTasks.length }}）</h2>
      <ul v-if="taskStore.filteredTasks.length" class="task-list">
        <li v-for="t in taskStore.filteredTasks" :key="t._id" class="task-item glass glass-hover">
          <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }" class="task-link">
            {{ t.title }}
          </RouterLink>
          <span class="status">{{ t.status }}</span>
        </li>
      </ul>
      <p v-else class="empty">该项目暂无任务</p>
    </section>

    <ConfirmDialog
      title="确认删除"
      message="删除项目将同时移除其所有任务，确定要继续吗？"
      :visible="showDeleteConfirm"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.project-detail {
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

header .actions {
  display: flex;
  gap: var(--space-sm);
}

.form-panel {
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.info {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.info-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-value {
  font-size: 0.9375rem;
  color: var(--color-text);
  line-height: 1.5;
}

.info-value.mono {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
}

.tasks {
  margin-top: var(--space-2xl);
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--color-text);
}

.task-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
}

.task-link {
  font-weight: 500;
  color: var(--color-text);
}

.task-link:hover {
  color: var(--color-accent);
  opacity: 1;
}

.status {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.03em;
}

.empty {
  color: var(--color-text-secondary);
  padding: var(--space-xl);
  text-align: center;
  font-size: 0.9375rem;
}
</style>
