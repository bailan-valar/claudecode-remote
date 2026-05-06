import { createRouter, createWebHashHistory } from 'vue-router'

const HomeView = () => import('../views/HomeView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', name: 'home', component: HomeView }],
})
