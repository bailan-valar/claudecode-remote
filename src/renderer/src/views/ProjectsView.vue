<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/useProjectStore'
import ProjectForm from '../components/ProjectForm.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import type { Project } from '../../../shared/types'

const router = useRouter()
const projectStore = useProjectStore()
const showForm = ref(false)
const editingProject = ref<Project | null>(null)
const deletingProjectId = ref<string | null>(null)

onMounted(() => projectStore.fetch())
</script>

<template>
  <div class="projects-page">
    <header>
      <h1 class="page-title">项目</h1>
      <button class="glass-button primary" @click="showForm = true">+ 新建项目</button>
    </header>

    <div v-if="showForm" class="form-panel glass">
      <ProjectForm
        @submit="showForm = false"
        @cancel="showForm = false"
      />
    </div>
    <div v-else-if="editingProject" class="form-panel glass">
      <ProjectForm
        :initial-project="editingProject"
        mode="edit"
        @submit="$event && projectStore.update(editingProject._id, $event); editingProject = null"
        @cancel="editingProject = null"
      />
    </div>

    <div v-if="projectStore.isLoading" class="loading">加载中...</div>
    <EmptyState v-else-if="projectStore.projects.length === 0" message="暂无项目，点击上方按钮创建" />
    <ul v-else class="project-list">
      <li v-for="p in projectStore.projects" :key="p._id" class="project-item glass glass-hover">
        <div class="row">
          <RouterLink :to="{ name: 'project-detail', params: { id: p._id } }" class="name">
            {{ p.name }}
          </RouterLink>
          <span class="path">{{ p.path }}</span>
        </div>
        <p v-if="p.description" class="desc">{{ p.description }}</p>
        <div class="actions">
          <button class="glass-button" @click="editingProject = p">编辑</button>
          <button class="glass-button danger" @click="deletingProjectId = p._id">删除</button>
        </div>
      </li>
    </ul>

    <ConfirmDialog
      title="确认删除"
      message="删除后不可恢复，确定要继续吗？"
      :visible="deletingProjectId !== null"
      @confirm="projectStore.remove(deletingProjectId!); deletingProjectId = null"
      @cancel="deletingProjectId = null"
    />
  </div>
</template>

<style scoped>
.projects-page {
  max-width: 900px;
  margin: 0 auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.form-panel {
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.loading {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.project-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.project-item {
  padding: var(--space-lg);
  cursor: default;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.name {
  font-weight: 600;
  font-size: 1.0625rem;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.name:hover {
  opacity: 1;
  color: var(--color-accent);
}

.path {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  font-family: 'SF Mono', Monaco, monospace;
}

.desc {
  margin: var(--space-sm) 0;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.actions .glass-button {
  font-size: 0.8125rem;
  padding: var(--space-xs) var(--space-md);
  min-height: 32px;
}
</style>
