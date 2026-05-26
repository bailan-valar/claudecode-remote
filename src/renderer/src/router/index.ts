import { createRouter, createWebHashHistory } from 'vue-router'
import { useProjectStore } from '../stores/useProjectStore'

const HomeView = () => import('../views/HomeView.vue')
const TasksView = () => import('../views/TasksView.vue')
const TaskDetailView = () => import('../views/TaskDetailView.vue')
const ProjectDetailView = () => import('../views/ProjectDetailView.vue')
const SettingsView = () => import('../views/SettingsView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { keepAlive: true, cacheName: 'home' } },
    {
      path: '/projects',
      redirect: () => {
        const projectStore = useProjectStore()
        if (projectStore.projects.length > 0) {
          return { name: 'project-detail', params: { id: projectStore.projects[0]._id } }
        }
        return { name: 'home' }
      }
    },
    { path: '/projects/:id', name: 'project-detail', component: ProjectDetailView, meta: { keepAlive: true, cacheName: 'project-detail' } },
    { path: '/tasks', name: 'tasks', component: TasksView, meta: { keepAlive: true, cacheName: 'tasks' } },
    { path: '/tasks/:id', name: 'task-detail', component: TaskDetailView, meta: { keepAlive: true, cacheName: 'task-detail' } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { keepAlive: false } },
  ],
})
