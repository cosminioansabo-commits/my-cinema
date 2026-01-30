<script setup lang="ts">
import { ref } from 'vue'
import PlaybackModal from './PlaybackModal.vue'
import ContinueWatchingCard from './ContinueWatchingCard.vue'
import Button from 'primevue/button'
import { useCarouselScroll } from '@/composables/useCarouselScroll'
import { progressService } from '@/services/progressService'
import { useLanguage } from '@/composables/useLanguage'

export interface ContinueWatchingItem {
  id: number
  mediaType: 'movie' | 'episode'
  tmdbId: number
  seasonNumber: number | null
  episodeNumber: number | null
  positionMs: number
  durationMs: number
  progress: number
  updatedAt: string
  // TMDB enriched data
  title?: string
  posterPath?: string | null
  episodeTitle?: string
}

const props = withDefaults(defineProps<{
  title: string
  items: ContinueWatchingItem[]
  loading?: boolean
  cardWidth?: number
}>(), {
  cardWidth: 180,
})

const { t } = useLanguage()

const emit = defineEmits<{
  refresh: []
}>()

const { trackRef, canScrollLeft, canScrollRight, cardStyle, scroll } = useCarouselScroll({
  cardWidth: props.cardWidth,
})

// Playback modal state
const showPlayback = ref(false)
const playbackItem = ref<ContinueWatchingItem | null>(null)

// Handle item click - resume playback
const handleItemClick = (item: ContinueWatchingItem) => {
  playbackItem.value = item
  showPlayback.value = true
}

// Handle removing a single item
const handleRemoveItem = async (item: ContinueWatchingItem) => {
  await progressService.removeProgress(
    item.mediaType,
    item.tmdbId,
    item.seasonNumber ?? undefined,
    item.episodeNumber ?? undefined
  )
  emit('refresh')
}

// Handle clearing all continue watching
const handleClearAll = async () => {
  await progressService.clearAllProgress()
  emit('refresh')
}

// Handle playback modal visibility change
const handlePlaybackVisibilityChange = (visible: boolean) => {
  if (!visible) {
    // Modal closed - refresh the continue watching list
    playbackItem.value = null
    emit('refresh')
  }
}
</script>

<template>
  <section v-if="items.length > 0 || loading" class="carousel-section">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="row-title text-base sm:text-lg md:text-xl flex items-center gap-2 sm:gap-3">
        <i class="pi pi-play-circle text-[#e50914]"></i>
        {{ title }}
      </h2>
      <Button
        v-if="items.length > 0"
        :label="t('continueWatching.clearAll')"
        icon="pi pi-trash"
        text
        severity="secondary"
        size="small"
        @click="handleClearAll"
      />
    </div>

    <!-- Carousel -->
    <div class="carousel-container group">
      <!-- Left Arrow -->
      <button
        v-show="canScrollLeft && !loading"
        class="carousel-btn carousel-btn-left hidden sm:flex"
        @click="scroll('left')"
        aria-label="Scroll left"
      >
        <i class="pi pi-chevron-left text-base sm:text-lg"></i>
      </button>

      <!-- Track -->
      <div
        ref="trackRef"
        class="carousel-track"
      >
        <!-- Loading skeletons -->
        <template v-if="loading">
          <div
            v-for="i in 6"
            :key="`skeleton-${i}`"
            class="carousel-item"
            :style="cardStyle"
          >
            <div class="bg-[#181818] rounded-xl overflow-hidden shadow-lg shadow-black/30 border border-zinc-800/50 animate-pulse">
              <div class="aspect-2/3 bg-zinc-800"></div>
            </div>
          </div>
        </template>

        <!-- Continue watching cards -->
        <template v-else>
          <div
            v-for="item in items"
            :key="`${item.mediaType}-${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`"
            class="carousel-item"
            :style="cardStyle"
          >
            <ContinueWatchingCard :item="item" @click="handleItemClick(item)" @remove="handleRemoveItem(item)" />
          </div>
        </template>
      </div>

      <!-- Right Arrow -->
      <button
        v-show="canScrollRight && !loading"
        class="carousel-btn carousel-btn-right hidden sm:flex"
        @click="scroll('right')"
        aria-label="Scroll right"
      >
        <i class="pi pi-chevron-right text-base sm:text-lg"></i>
      </button>
    </div>

    <!-- Playback Modal -->
    <PlaybackModal
      v-if="playbackItem"
      v-model:visible="showPlayback"
      :tmdb-id="playbackItem.mediaType === 'movie' ? playbackItem.tmdbId : undefined"
      :show-tmdb-id="playbackItem.mediaType === 'episode' ? playbackItem.tmdbId : undefined"
      :media-type="playbackItem.mediaType === 'movie' ? 'movie' : 'tv'"
      :season-number="playbackItem.seasonNumber ?? undefined"
      :episode-number="playbackItem.episodeNumber ?? undefined"
      :title="playbackItem.title || 'Continue Watching'"
      @update:visible="handlePlaybackVisibilityChange"
    />
  </section>
</template>

