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
      path: '/profiles',
      name: 'profiles',
      component: () => import('@/views/ProfileSelectView.vue'),
      meta: { requiresAuth: true, skipProfile: true }
    },
    {
      path: '/profiles/:id/manage',
      name: 'profile-manage',
      component: () => import('@/views/ProfileManageView.vue'),
      meta: { requiresAuth: true, skipProfile: true }
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
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { public: true },
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

  // If auth is not enabled, allow all routes (skip profile selection too)
  if (authStore.authEnabled === false) {
    if (to.name === 'login' || to.name === 'profiles' || to.name === 'profile-manage') {
      return next({ name: 'home' })
    }
    return next()
  }

  // Public routes don't need auth
  if (to.meta.public) {
    if (to.name === 'login' && authStore.isAuthenticated) {
      return next(authStore.hasProfile ? { name: 'home' } : { name: 'profiles' })
    }
    return next()
  }

  // Protected routes need auth
  if (!authStore.isAuthenticated) {
    return next({ name: 'login' })
  }

  // Profile selection pages — allow even without profile
  if (to.meta.skipProfile) {
    return next()
  }

  // All other routes require a profile to be selected
  if (!authStore.hasProfile) {
    return next({ name: 'profiles' })
  }

  next()
})

export default router
