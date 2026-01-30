<script setup lang="ts">
import { getImageUrl } from '@/services/tmdbService'
import { formatRemainingTime } from '@/utils/formatters'
import type { ContinueWatchingItem } from './ContinueWatchingCarousel.vue'

const props = defineProps<{
  item: ContinueWatchingItem
}>()

const emit = defineEmits<{
  click: []
  remove: []
}>()

const posterUrl = props.item.posterPath
  ? getImageUrl(props.item.posterPath, 'w300') || ''
  : ''

const displayTitle = props.item.mediaType === 'episode' && props.item.seasonNumber && props.item.episodeNumber
  ? `S${props.item.seasonNumber}:E${props.item.episodeNumber}`
  : props.item.title || 'Unknown'
</script>

<template>
  <div
    class="continue-watching-card group/card relative bg-[#181818] rounded-xl overflow-hidden shadow-lg shadow-black/30 border border-zinc-800/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-zinc-700/50 cursor-pointer"
    @click="emit('click')"
  >
    <!-- Poster -->
    <div class="aspect-2/3 relative">
      <img
        v-if="posterUrl"
        :src="posterUrl"
        :alt="item.title || 'Media'"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div v-else class="w-full h-full bg-zinc-800 flex items-center justify-center">
        <i class="pi pi-image text-3xl text-zinc-600"></i>
      </div>

      <!-- Play Overlay -->
      <div class="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
        <div class="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
          <i class="pi pi-play text-2xl text-black ml-1"></i>
        </div>
      </div>

      <!-- Remove Button -->
      <button
        class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-10"
        @click.stop="emit('remove')"
      >
        <i class="pi pi-times text-[10px] text-white"></i>
      </button>

      <!-- Episode Badge -->
      <div
        v-if="item.mediaType === 'episode'"
        class="absolute top-2 left-2 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white"
      >
        {{ displayTitle }}
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
      <div
        class="h-full bg-[#e50914] transition-all"
        :style="{ width: `${item.progress}%` }"
      />
    </div>

    <!-- Info Overlay -->
    <div class="absolute bottom-1 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
      <p class="text-white text-xs font-medium truncate">{{ item.title || 'Unknown' }}</p>
      <p class="text-gray-400 text-[10px]">{{ formatRemainingTime(item.positionMs, item.durationMs) }}</p>
    </div>
  </div>
</template>

<style scoped>
.continue-watching-card {
  aspect-ratio: 2/3;
}
</style>
