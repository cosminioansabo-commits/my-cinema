<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import DownloadManager from '@/components/torrents/DownloadManager.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import { useAuthStore } from '@/stores/authStore'
import { useProfileStore } from '@/stores/profileStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useLanguage } from '@/composables/useLanguage'
import { onMounted } from 'vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()
const notificationStore = useNotificationStore()
const { t } = useLanguage()

onMounted(async () => {
  if (authStore.hasProfile && profileStore.profiles.length === 0) {
    await profileStore.fetchProfiles()
    profileStore.setActiveFromToken()
  }
})

const handleSwitchProfile = () => {
  router.push({ name: 'profiles' })
}

const handleLogout = () => {
  authStore.logout()
  profileStore.clearActive()
  router.push({ name: 'login' })
}

const emit = defineEmits<{
  toggleSidebar: []
}>()

const navLinks = [
  { path: '/', labelKey: 'nav.home', icon: 'pi-home' },
  { path: '/browse', labelKey: 'nav.browse', icon: 'pi-compass' },
  { path: '/my-library', labelKey: 'nav.myLibrary', icon: 'pi-database' },
  { path: '/calendar', labelKey: 'nav.calendar', icon: 'pi-calendar' },
]

const isActiveRoute = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#141414] shadow-lg shadow-black/30">
    <div class="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-14 flex items-center justify-between gap-2 sm:gap-4">
      <!-- Logo & Mobile Menu -->
      <div class="flex items-center gap-3 sm:gap-6">
        <button
          class="lg:hidden p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
          @click="emit('toggleSidebar')"
        >
          <i class="pi pi-bars text-lg sm:text-xl"></i>
        </button>

        <RouterLink to="/" class="flex items-center gap-0.5 sm:gap-1 font-bold text-lg sm:text-xl md:text-2xl">
          <span class="text-[#e50914]">MY</span>
          <span class="text-white">CINEMA</span>
        </RouterLink>

        <!-- Desktop Navigation -->
        <nav class="hidden lg:flex items-center gap-2">
          <RouterLink
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="relative px-5 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group"
            :class="[
              isActiveRoute(link.path)
                ? 'text-white bg-white/10'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            ]"
          >
            <span class="relative z-10">{{ t(link.labelKey) }}</span>
            <!-- Active indicator -->
            <span
              v-if="isActiveRoute(link.path)"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#e50914] rounded-full"
            ></span>
          </RouterLink>
        </nav>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Language Selector (Desktop only) -->
        <div class="hidden lg:block">
          <LanguageSelector />
        </div>

        <!-- Search icon -->
        <RouterLink
          to="/search"
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
          :class="isActiveRoute('/search') ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'"
          title="Search"
        >
          <i class="pi pi-search text-lg"></i>
        </RouterLink>

        <!-- Notifications icon -->
        <RouterLink
          to="/notifications"
          class="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
          :class="isActiveRoute('/notifications') ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'"
          :title="t('notifications.title')"
        >
          <i class="pi pi-bell text-lg"></i>
          <!-- Unread badge -->
          <span
            v-if="notificationStore.unreadCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#e50914] text-white text-[10px] font-bold rounded-full"
          >
            {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
          </span>
        </RouterLink>

        <!-- Download Manager -->
        <DownloadManager />

        <!-- Profile Avatar (switch profile) -->
        <button
          v-if="profileStore.activeProfile"
          @click="handleSwitchProfile"
          class="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:ring-2 hover:ring-white/30"
          :style="{ backgroundColor: profileStore.activeProfile.avatarColor }"
          :title="profileStore.activeProfile.name"
        >
          <i :class="['pi', profileStore.activeProfile.avatarIcon, 'text-sm text-white']"></i>
        </button>

        <!-- Logout button (only show when auth is enabled and authenticated) -->
        <button
          v-if="authStore.authEnabled && authStore.isAuthenticated"
          @click="handleLogout"
          class="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          :title="t('nav.logout')"
        >
          <i class="pi pi-sign-out text-lg"></i>
        </button>
      </div>
    </div>
  </header>
</template>
