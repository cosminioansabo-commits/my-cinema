<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import Toast from 'primevue/toast'

const sidebarVisible = ref(false)

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}
</script>

<template>
  <div class="dark-mode min-h-screen bg-[#141414] text-white">
    <AppHeader @toggle-sidebar="toggleSidebar" />
    <AppSidebar v-model:visible="sidebarVisible" />

    <main class="pt-20 min-h-screen">
      <div class="max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-12 xl:px-16 py-8">
        <RouterView />
      </div>
    </main>

    <Toast position="bottom-right" />
  </div>
</template>
