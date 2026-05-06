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
      <h2 v-if="!isEditing">{{ project.name }}</h2>
      <div class="actions">
        <button v-if="!isEditing" @click="isEditing = true">编辑</button>
        <button v-else @click="isEditing = false">取消编辑</button>
        <button class="danger" @click="showDeleteConfirm = true">删除</button>
      </div>
    </header>

    <ProjectForm
      v-if="isEditing"
      :initial-project="project"
      mode="edit"
      @submit="handleUpdate"
      @cancel="isEditing = false"
    />

    <section v-else class="info">
      <p><strong>路径：</strong>{{ project.path }}</p>
      <p><strong>描述：</strong>{{ project.description || '无' }}</p>
      <p><strong>创建时间：</strong>{{ new Date(project.createdAt).toLocaleString() }}</p>
    </section>

    <section class="tasks">
      <h3>关联任务（{{ taskStore.filteredTasks.length }}）</h3>
      <ul v-if="taskStore.filteredTasks.length">
        <li v-for="t in taskStore.filteredTasks" :key="t._id">
          <RouterLink :to="{ name: 'task-detail', params: { id: t._id } }">{{ t.title }}</RouterLink>
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
.project-detail { padding: var(--space-lg); max-width: 800px; }
.loading { padding: var(--space-lg); color: var(--color-muted); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.info p { margin-bottom: var(--space-md); }
.tasks { margin-top: var(--space-xl); }
.tasks h3 { font-size: 1rem; margin-bottom: var(--space-sm); }
.tasks ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
.tasks li { display: flex; justify-content: space-between; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius); }
.empty { color: var(--color-muted); padding: var(--space-md); text-align: center; }
button { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-size: 0.875rem; cursor: pointer; }
button.danger { border-color: var(--color-error); color: var(--color-error); }
button:hover { background: #f3f4f6; }
</style>
