<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTaskStore } from '../stores/useTaskStore'
import { useProjectStore } from '../stores/useProjectStore'
import TaskForm from '../components/TaskForm.vue'

const taskStore = useTaskStore()
const projectStore = useProjectStore()
const showForm = ref(false)

onMounted(() => {
  taskStore.fetch()
  projectStore.fetch()
})
</script>

<template>
  <div class="tasks-page">
    <header>
      <h2>任务</h2>
      <button @click="showForm = true">+ 新建任务</button>
    </header>

    <TaskForm
      v-if="showForm"
      :projects="projectStore.projects"
      @submit="showForm = false"
      @cancel="showForm = false"
    />

    <div v-if="taskStore.isLoading">加载中...</div>
    <ul v-else class="task-list">
      <li v-for="t in taskStore.tasks" :key="t._id" class="task-item">
        <span class="status" :class="t.status">{{ t.status }}</span>
        <strong>{{ t.title }}</strong>
        <span class="project">{{ t.projectId }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tasks-page { padding: 1rem; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.task-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.task-item { border: 1px solid #ddd; border-radius: 4px; padding: 0.75rem; display: flex; gap: 0.5rem; align-items: center; }
.status { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 4px; background: #eee; }
.status.planned { background: #e3f2fd; }
.status.completed { background: #e8f5e9; }
.project { color: #666; font-size: 0.875rem; margin-left: auto; }
</style>
