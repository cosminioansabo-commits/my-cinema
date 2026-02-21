<script setup lang="ts">
import Button from 'primevue/button'
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
    <div class="w-24 h-24 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-8 border border-zinc-700/50">
      <i class="pi pi-exclamation-triangle text-5xl text-gray-500"></i>
    </div>
    <h1 class="text-4xl sm:text-5xl font-bold text-white mb-4">404</h1>
    <p class="text-lg sm:text-xl text-gray-400 mb-2">Page not found</p>
    <p class="text-sm text-gray-500 mb-8 max-w-md">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <RouterLink to="/">
      <Button
        label="Go Home"
        icon="pi pi-home"
        severity="contrast"
        class="!bg-[#e50914] hover:!bg-[#b20710] !border-none !text-white"
      />
    </RouterLink>
  </div>
</template>
