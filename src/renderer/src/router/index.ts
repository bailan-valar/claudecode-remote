import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore'

const LoginView = () => import('../views/LoginView.vue')
const HomeView = () => import('../views/HomeView.vue')
const ProjectsView = () => import('../views/ProjectsView.vue')
const TasksView = () => import('../views/TasksView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'home', component: HomeView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/tasks', name: 'tasks', component: TasksView },
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
