<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
const THRESHOLD = 500

const handleScroll = () => {
  visible.value = window.scrollY > THRESHOLD
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <Transition name="fade">
    <button
      v-show="visible"
      class="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-zinc-800/80 backdrop-blur-md border border-zinc-700/50 text-white shadow-lg shadow-black/30 hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-200 flex items-center justify-center cursor-pointer"
      aria-label="Scroll to top"
      @click="scrollToTop"
    >
      <i class="pi pi-chevron-up text-sm"></i>
    </button>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
