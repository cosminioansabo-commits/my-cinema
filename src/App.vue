<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import KeyboardShortcutsModal from '@/components/modals/KeyboardShortcutsModal.vue'
import SpotlightSearch from '@/components/modals/SpotlightSearch.vue'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import notificationService, { APP_NOTIFICATION_EVENT } from '@/services/notificationService'
import { useOfflineStore } from '@/stores/offlineStore'

const route = useRoute()
const toast = useToast()
const sidebarVisible = ref(false)
const offlineStore = useOfflineStore()

// Initialize global keyboard shortcuts
useKeyboardShortcuts()

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

// Hide header/sidebar on login, profile select, and profile manage pages
const showLayout = computed(() => {
  return route.name !== 'login' && route.name !== 'profiles' && route.name !== 'profile-manage'
})

// Listen for in-app notification fallback events
const handleAppNotification = (e: Event) => {
  const { title, body } = (e as CustomEvent).detail
  toast.add({ severity: 'info', summary: title, detail: body, life: 5000 })
}

// Watch for offline download errors
watch(() => offlineStore.lastError, (error) => {
  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Download Failed',
      detail: `${error.title}: ${error.error}`,
      life: 8000
    })
    offlineStore.clearLastError()
  }
})

// Add dark-mode class to html element for PrimeVue overlays
onMounted(() => {
  document.documentElement.classList.add('dark-mode')
  notificationService.requestPermission()
  window.addEventListener(APP_NOTIFICATION_EVENT, handleAppNotification)

  // Initialize offline download store listeners
  offlineStore.initializeListeners()
  offlineStore.loadOfflineMedia()
})

onUnmounted(() => {
  window.removeEventListener(APP_NOTIFICATION_EVENT, handleAppNotification)
})
</script>

<template>
  <div class="dark-mode min-h-screen bg-[#141414] text-white">
    <template v-if="showLayout">
      <AppHeader @toggle-sidebar="toggleSidebar" />
      <AppSidebar v-model:visible="sidebarVisible" />
    </template>

    <main :class="showLayout ? 'pt-14 min-h-screen' : 'min-h-screen'">
      <div :class="showLayout ? 'max-w-[1920px] px-4' : ''">
        <RouterView />
      </div>
    </main>

    <Toast position="bottom-right" />

    <!-- Global Keyboard Shortcuts Help Modal -->
    <KeyboardShortcutsModal />
    <SpotlightSearch />
  </div>
</template>
