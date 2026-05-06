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
      <h2>项目</h2>
      <button @click="showForm = true">+ 新建项目</button>
    </header>

    <ProjectForm
      v-if="showForm"
      @submit="showForm = false"
      @cancel="showForm = false"
    />
    <ProjectForm
      v-else-if="editingProject"
      :initial-project="editingProject"
      mode="edit"
      @submit="$event && projectStore.update(editingProject._id, $event); editingProject = null"
      @cancel="editingProject = null"
    />

    <div v-if="projectStore.isLoading">加载中...</div>
    <EmptyState v-else-if="projectStore.projects.length === 0" message="暂无项目，点击上方按钮创建" />
    <ul v-else class="project-list">
      <li v-for="p in projectStore.projects" :key="p._id" class="project-item">
        <div class="row">
          <RouterLink :to="{ name: 'project-detail', params: { id: p._id } }" class="name">{{ p.name }}</RouterLink>
          <span class="path">{{ p.path }}</span>
        </div>
        <p v-if="p.description" class="desc">{{ p.description }}</p>
        <div class="actions">
          <button @click="editingProject = p">编辑</button>
          <button class="danger" @click="deletingProjectId = p._id">删除</button>
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
.projects-page { padding: var(--space-md); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); }
.project-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
.project-item { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-md); }
.row { display: flex; align-items: center; gap: var(--space-sm); }
.name { font-weight: 500; color: var(--color-text); text-decoration: none; }
.name:hover { text-decoration: underline; }
.path { color: var(--color-muted); font-size: 0.875rem; }
.desc { margin: var(--space-sm) 0; color: #444; font-size: 0.875rem; }
.actions { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
.actions button { padding: var(--space-xs) var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.75rem; cursor: pointer; }
.actions button.danger { color: var(--color-error); border-color: var(--color-error); }
</style>
