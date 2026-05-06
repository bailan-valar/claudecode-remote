<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useProjectStore } from '../stores/useProjectStore'
import ProjectForm from '../components/ProjectForm.vue'

const projectStore = useProjectStore()
const showForm = ref(false)

onMounted(() => projectStore.fetch())
</script>

<template>
  <div class="projects-page">
    <header>
      <h2>项目</h2>
      <button @click="showForm = true">+ 新建项目</button>
    </header>

    <ProjectForm v-if="showForm" @submit="showForm = false" @cancel="showForm = false" />

    <div v-if="projectStore.isLoading">加载中...</div>
    <ul v-else class="project-list">
      <li v-for="p in projectStore.projects" :key="p._id" class="project-item">
        <strong>{{ p.name }}</strong>
        <span class="path">{{ p.path }}</span>
        <p v-if="p.description" class="desc">{{ p.description }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.projects-page { padding: 1rem; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.project-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.project-item { border: 1px solid #ddd; border-radius: 4px; padding: 0.75rem; }
.path { color: #666; font-size: 0.875rem; margin-left: 0.5rem; }
.desc { margin: 0.5rem 0 0; color: #444; font-size: 0.875rem; }
</style>
