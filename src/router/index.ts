import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/browse',
      name: 'browse',
      component: () => import('@/views/BrowseView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
    },
    {
      path: '/media/:type/:id',
      name: 'media-detail',
      component: () => import('@/views/MediaDetailView.vue'),
      props: true,
    },
    {
      path: '/my-library',
      name: 'my-library',
      component: () => import('@/views/MyListsView.vue'),
    },
    {
      path: '/downloads',
      name: 'downloads',
      component: () => import('@/views/DownloadsView.vue'),
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationsView.vue'),
    },
    {
      path: '/actor/:id',
      name: 'actor',
      component: () => import('@/views/ActorView.vue'),
      props: true,
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

// Navigation guard for authentication
let authInitialized = false

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Initialize auth on first navigation
  if (!authInitialized) {
    await authStore.initialize()
    authInitialized = true
  }

  // If auth is not enabled, allow all routes
  if (authStore.authEnabled === false) {
    // If on login page but auth is disabled, redirect to home
    if (to.name === 'login') {
      return next({ name: 'home' })
    }
    return next()
  }

  // Public routes don't need auth
  if (to.meta.public) {
    // If already authenticated and trying to access login, redirect to home
    if (to.name === 'login' && authStore.isAuthenticated) {
      return next({ name: 'home' })
    }
    return next()
  }

  // Protected routes need auth
  if (!authStore.isAuthenticated) {
    return next({ name: 'login' })
  }

  next()
})

export default router
