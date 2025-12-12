<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useDebounce } from '@/composables/useDebounce'
import InputText from 'primevue/inputtext'
import DownloadManager from '@/components/torrents/DownloadManager.vue'

const route = useRoute()
const router = useRouter()

const emit = defineEmits<{
  toggleSidebar: []
}>()

const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const isSearchOpen = ref(false)
const isScrolled = ref(false)

const navLinks = [
  { path: '/', label: 'Home', icon: 'pi-home' },
  { path: '/browse', label: 'Browse', icon: 'pi-compass' },
  { path: '/my-lists', label: 'My Lists', icon: 'pi-list' },
]

const isActiveRoute = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push({ name: 'search', query: { q: searchQuery.value.trim() } })
    isSearchOpen.value = false
  }
}

const handleSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSearch()
  }
  if (e.key === 'Escape') {
    isSearchOpen.value = false
    searchQuery.value = ''
  }
}

const toggleSearch = () => {
  isSearchOpen.value = !isSearchOpen.value
  if (!isSearchOpen.value) {
    searchQuery.value = ''
  }
}

// Scroll handler for header background
const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    :class="[
      isScrolled
        ? 'bg-[#141414]'
        : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent'
    ]"
  >
    <div class="max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-12 xl:px-16 h-20 flex items-center justify-between gap-4">
      <!-- Logo & Mobile Menu -->
      <div class="flex items-center gap-6">
        <button
          class="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          @click="emit('toggleSidebar')"
        >
          <i class="pi pi-bars text-xl"></i>
        </button>

        <RouterLink to="/" class="flex items-center gap-1 font-bold text-xl md:text-2xl">
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
            <span class="relative z-10">{{ link.label }}</span>
            <!-- Active indicator -->
            <span
              v-if="isActiveRoute(link.path)"
              class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#e50914] rounded-full"
            ></span>
          </RouterLink>
        </nav>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-4">
        <!-- Desktop Search (expandable) -->
        <div class="hidden md:flex relative items-center">
          <div
            class="flex items-center overflow-hidden transition-all duration-300 ease-out"
            :class="[
              isSearchOpen
                ? 'w-72 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-xl shadow-black/30'
                : 'w-auto'
            ]"
          >
            <button
              class="p-3 transition-all duration-200 rounded-lg"
              :class="isSearchOpen ? 'text-[#e50914]' : 'text-gray-300 hover:text-white hover:bg-white/5'"
              @click="toggleSearch"
            >
              <i class="pi pi-search text-lg"></i>
            </button>

            <input
              v-if="isSearchOpen"
              v-model="searchQuery"
              type="text"
              placeholder="Titles, people, genres"
              class="flex-1 bg-transparent text-white text-sm py-2.5 pr-4 placeholder-gray-500 focus:outline-none"
              @keydown="handleSearchKeydown"
              autofocus
            />

            <button
              v-if="isSearchOpen && searchQuery"
              class="p-2 mr-1 text-gray-400 hover:text-white transition-colors"
              @click="searchQuery = ''"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>
        </div>

        <!-- Mobile search button -->
        <button
          class="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
          @click="router.push({ name: 'search' })"
        >
          <i class="pi pi-search text-lg"></i>
        </button>

        <!-- Download Manager -->
        <DownloadManager />
      </div>
    </div>
  </header>
</template>
