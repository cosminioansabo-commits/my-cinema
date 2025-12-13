<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import Toast from 'primevue/toast'

const route = useRoute()
const sidebarVisible = ref(false)

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

// Hide header/sidebar on login page
const showLayout = computed(() => route.name !== 'login')
</script>

<template>
  <div class="dark-mode min-h-screen bg-[#141414] text-white">
    <template v-if="showLayout">
      <AppHeader @toggle-sidebar="toggleSidebar" />
      <AppSidebar v-model:visible="sidebarVisible" />
    </template>

    <main :class="showLayout ? 'pt-16 sm:pt-20 min-h-screen' : 'min-h-screen'">
      <div :class="showLayout ? 'max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-10 xl:px-14 py-4 sm:py-6' : ''">
        <RouterView />
      </div>
    </main>

    <Toast position="bottom-right" />
  </div>
</template>
