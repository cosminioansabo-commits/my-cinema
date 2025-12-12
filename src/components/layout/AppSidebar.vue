<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useListsStore } from '@/stores/listsStore'
import Drawer from 'primevue/drawer'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const route = useRoute()
const listsStore = useListsStore()

const navLinks = [
  { path: '/', label: 'Home', icon: 'pi-home' },
  { path: '/browse', label: 'Browse', icon: 'pi-compass' },
  { path: '/search', label: 'Search', icon: 'pi-search' },
  { path: '/my-lists', label: 'My Lists', icon: 'pi-list' },
  { path: '/calendar', label: 'Calendar', icon: 'pi-calendar' },
  { path: '/downloads', label: 'Downloads', icon: 'pi-download' },
]

const isActiveRoute = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const closeSidebar = () => {
  emit('update:visible', false)
}
</script>

<template>
  <Drawer
    :visible="props.visible"
    @update:visible="emit('update:visible', $event)"
    :showCloseIcon="false"
    :pt="{
      root: { class: 'bg-[#141414] border-r border-zinc-800' },
      header: { class: 'bg-[#141414] border-b border-zinc-800 p-4' },
      content: { class: 'bg-[#141414] p-0' },
      mask: { class: 'bg-black/60 backdrop-blur-sm' },
    }"
    class="w-80"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <RouterLink to="/" class="flex items-center gap-1 font-bold text-xl" @click="closeSidebar">
          <span class="text-[#e50914]">MY</span>
          <span class="text-white">CINEMA</span>
        </RouterLink>
        <button
          class="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors"
          @click="closeSidebar"
        >
          <i class="pi pi-times text-gray-400"></i>
        </button>
      </div>
    </template>

    <div class="flex flex-col h-full text-white">
      <!-- Main Navigation -->
      <nav class="space-y-1 px-4 py-5">
        <RouterLink
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200"
          :class="[
            isActiveRoute(link.path)
              ? 'bg-[#e50914] text-white shadow-lg shadow-[#e50914]/20'
              : 'text-gray-300 hover:bg-zinc-800 hover:text-white'
          ]"
          @click="closeSidebar"
        >
          <i :class="['pi', link.icon, 'text-lg']"></i>
          <span class="font-medium">{{ link.label }}</span>
        </RouterLink>
      </nav>

      <!-- Divider -->
      <div class="h-px bg-zinc-800 mx-6"></div>

      <!-- Quick Lists -->
      <div class="flex-1 overflow-y-auto px-4 py-5">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
          My Lists
        </h3>
        <nav class="space-y-1">
          <RouterLink
            v-for="list in listsStore.defaultLists"
            :key="list.id"
            :to="`/list/${list.id}`"
            class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-300 hover:bg-zinc-800 hover:text-white transition-all duration-200"
            @click="closeSidebar"
          >
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" :style="{ backgroundColor: list.color + '20' }">
              <i :class="['pi', list.icon, 'text-sm']" :style="{ color: list.color }"></i>
            </div>
            <span class="flex-1 font-medium">{{ list.name }}</span>
            <span class="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">{{ list.items.length }}</span>
          </RouterLink>
        </nav>

        <!-- Custom Lists -->
        <div v-if="listsStore.customLists.length > 0" class="mt-6">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mb-3">
            Custom Lists
          </h3>
          <nav class="space-y-1">
            <RouterLink
              v-for="list in listsStore.customLists"
              :key="list.id"
              :to="`/list/${list.id}`"
              class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-300 hover:bg-zinc-800 hover:text-white transition-all duration-200"
              @click="closeSidebar"
            >
              <div class="w-8 h-8 rounded-lg flex items-center justify-center" :style="{ backgroundColor: list.color + '20' }">
                <i :class="['pi', list.icon, 'text-sm']" :style="{ color: list.color }"></i>
              </div>
              <span class="flex-1 truncate font-medium">{{ list.name }}</span>
              <span class="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">{{ list.items.length }}</span>
            </RouterLink>
          </nav>
        </div>
      </div>
    </div>
  </Drawer>
</template>
