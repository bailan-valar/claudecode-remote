import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'

const LoginView = () => import('../views/LoginView.vue')
const HomeView = () => import('../views/HomeView.vue')
const ProjectsView = () => import('../views/ProjectsView.vue')
const TasksView = () => import('../views/TasksView.vue')
const TaskDetailView = () => import('../views/TaskDetailView.vue')
const ProjectDetailView = () => import('../views/ProjectDetailView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true, keepAlive: false } },
    { path: '/', name: 'home', component: HomeView, meta: { keepAlive: true, cacheName: 'home' } },
    { path: '/projects', name: 'projects', component: ProjectsView, meta: { keepAlive: true, cacheName: 'projects' } },
    { path: '/projects/:id', name: 'project-detail', component: ProjectDetailView, meta: { keepAlive: true, cacheName: 'project-detail' } },
    { path: '/tasks', name: 'tasks', component: TasksView, meta: { keepAlive: true, cacheName: 'tasks' } },
    { path: '/tasks/:id', name: 'task-detail', component: TaskDetailView, meta: { keepAlive: true, cacheName: 'task-detail' } },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!auth.currentUser && !to.meta.public) {
    return { name: 'login' }
  }
  if (auth.currentUser && to.name === 'login') {
    return { name: 'home' }
  }
})
