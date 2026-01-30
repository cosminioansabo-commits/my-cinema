<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import KeyboardShortcutsModal from '@/components/common/KeyboardShortcutsModal.vue'
import Toast from 'primevue/toast'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import notificationService from '@/services/notificationService'

const route = useRoute()
const sidebarVisible = ref(false)

// Initialize global keyboard shortcuts
useKeyboardShortcuts()

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

// Hide header/sidebar on login page
const showLayout = computed(() => route.name !== 'login')

// Add dark-mode class to html element for PrimeVue overlays
onMounted(() => {
  document.documentElement.classList.add('dark-mode')
  notificationService.requestPermission()
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
  </div>
</template>
