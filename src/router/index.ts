import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/reader',
      name: 'EpubReader',
      // @ts-ignore: Vue SFC types (add a shims-vue.d.ts to declare '*.vue' modules for a proper fix)
      component: () => import('../views/EpubReader.vue')
    },
    {
      path: '/reader2',
      name: 'EpubReader2',
      // @ts-ignore: Vue SFC types (add a shims-vue.d.ts to declare '*.vue' modules for a proper fix)
      component: () => import('../views/EpubReader2.vue')
    },
    {
      path: '/BookShelf',
      name: 'BookShelf',
      component: () => import('../views/BookShelf.vue')
    }
  ],
})

export default router
