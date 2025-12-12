<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { MediaList } from '@/types'
import { getImageUrl } from '@/services/tmdbService'

const props = defineProps<{
  list: MediaList
}>()

const previewImages = computed(() => {
  return props.list.items
    .slice(0, 4)
    .map(item => getImageUrl(item.posterPath, 'w200'))
})

const itemCount = computed(() => {
  const count = props.list.items.length
  return count === 1 ? '1 item' : `${count} items`
})
</script>

<template>
  <RouterLink
    :to="`/list/${list.id}`"
    class="group block bg-zinc-900/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-zinc-800/50 hover:border-zinc-700/50 hover:bg-zinc-800/80 transition-all duration-300 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1"
  >
    <!-- Preview grid -->
    <div class="aspect-[16/10] relative overflow-hidden">
      <div v-if="previewImages.length > 0" class="grid grid-cols-2 h-full gap-0.5 bg-zinc-800">
        <img
          v-for="(img, index) in previewImages"
          :key="index"
          :src="img"
          alt=""
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div
          v-for="i in (4 - previewImages.length)"
          :key="`empty-${i}`"
          class="bg-zinc-800 flex items-center justify-center"
        >
          <i class="pi pi-image text-zinc-700 text-xl"></i>
        </div>
      </div>
      <div v-else class="flex items-center justify-center h-full bg-gradient-to-br from-zinc-800 to-zinc-900">
        <div class="w-20 h-20 rounded-2xl flex items-center justify-center" :style="{ backgroundColor: list.color + '20' }">
          <i :class="['pi', list.icon, 'text-4xl']" :style="{ color: list.color }"></i>
        </div>
      </div>

      <!-- Overlay gradient -->
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent"></div>

      <!-- Item count badge -->
      <div class="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
        <span class="text-xs font-medium text-white">{{ itemCount }}</span>
      </div>

      <!-- Play icon on hover -->
      <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
        <div class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-transform duration-300">
          <i class="pi pi-play text-white text-xl ml-1"></i>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="p-5">
      <div class="flex items-center gap-4">
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
          :style="{ backgroundColor: list.color }"
        >
          <i :class="['pi', list.icon, 'text-white text-lg']"></i>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-white text-lg truncate group-hover:text-[#e50914] transition-colors">
            {{ list.name }}
          </h3>
          <p v-if="list.description" class="text-sm text-gray-400 truncate mt-0.5">
            {{ list.description }}
          </p>
          <p v-else class="text-sm text-gray-500 mt-0.5">
            {{ list.isDefault ? 'Default list' : 'Custom list' }}
          </p>
        </div>
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <i class="pi pi-arrow-right text-white text-sm"></i>
        </div>
      </div>
    </div>
  </RouterLink>
</template>
