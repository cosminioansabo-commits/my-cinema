<script setup lang="ts">
import { getImageUrl } from '@/services/tmdbService'
import { useFiltersStore } from '@/stores/filtersStore'
import type { Media } from '@/types'
import Card from 'primevue/card'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

const props = withDefaults(defineProps<{
  media: Media
  variant?: 'default' | 'compact' | 'wide'
}>(), {
  variant: 'default',
})

const filtersStore = useFiltersStore()
const imageLoaded = ref(false)

const posterUrl = computed(() => getImageUrl(props.media.posterPath, 'w300'))

const year = computed(() => {
  if (!props.media.releaseDate) return ''
  return new Date(props.media.releaseDate).getFullYear()
})

const rating = computed(() => {
  return props.media.voteAverage.toFixed(1)
})

const ratingPercent = computed(() => {
  return Math.round(props.media.voteAverage * 10)
})

const matchColor = computed(() => {
  const score = props.media.voteAverage
  if (score >= 7) return 'text-green-500'
  if (score >= 5) return 'text-yellow-500'
  return 'text-red-500'
})

const matchBgColor = computed(() => {
  const score = props.media.voteAverage
  if (score >= 7) return 'bg-green-500/20'
  if (score >= 5) return 'bg-yellow-500/20'
  return 'bg-red-500/20'
})

const mediaTypeLabel = computed(() => props.media.mediaType === 'movie' ? 'Movie' : 'Series')

// Get genre names from IDs
const genreNames = computed(() => {
  if (!props.media.genreIds || props.media.genreIds.length === 0) return []
  const allGenres = props.media.mediaType === 'movie'
      ? filtersStore.movieGenres
      : filtersStore.tvGenres
  return props.media.genreIds
      .slice(0, 2)
      .map(id => allGenres.find(g => g.id === id)?.name)
      .filter(Boolean)
})

const onImageLoad = () => {
  imageLoaded.value = true
}
</script>

<template>
  <!-- Compact variant for carousels -->
  <RouterLink
      v-if="variant === 'compact'"
      :to="`/media/${media.mediaType}/${media.id}`"
      class="media-card block group rounded-2xl"
  >
    <Card
        class="overflow-hidden"
    >
      <template #content>
        <div class="aspect-2/3 relative overflow-hidden">
          <img
              :src="posterUrl"
              :alt="media.title"
              class="w-full h-full object-cover transition-opacity duration-300"
              :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
              loading="lazy"
              @load="onImageLoad"
          />
          <!-- Hover overlay -->
          <div
              class="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div class="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4">
              <h3 class="font-semibold text-xs sm:text-sm text-white line-clamp-2 mb-1.5 sm:mb-2">
                {{ media.title }}
              </h3>
              <div class="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                <span :class="[matchColor, matchBgColor]"
                      class="font-bold px-1.5 sm:px-2 py-0.5 rounded">{{ ratingPercent }}%</span>
                <span class="text-gray-400">{{ year }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </RouterLink>

  <!-- Default variant for grids -->
  <div v-else class="media-card-wrapper">
    <RouterLink :to="`/media/${media.mediaType}/${media.id}`">
      <Card class="hover:scale-110 transition-transform duration-300 group">
        <template #header>
          <div class="w-full h-full overflow-hidden rounded-t-2xl">
            <img
                :src="posterUrl"
                :alt="media.title"
                class="w-full h-full object-cover rounded-t-2xl group-hover:scale-110 transition-transform duration-600"
                :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
                loading="lazy"
                @load="onImageLoad"
            />
          </div>
          <div class="absolute top-1 w-full flex justify-between px-2 py-1">
            <!-- Rating badge -->
            <div
                class="bg-black/40 border border-white/20 rounded-md sm:rounded-lg px-1 flex items-center gap-1 sm:gap-1.5 backdrop-blur-sm">
              <i class="pi pi-star-fill text-yellow-500 text-xs"></i>
              <span class="text-white text-xs ">{{ rating }}</span>
            </div>
            <!-- Media type badge -->
            <div
                class="border border-white/20 bg-black/40 backdrop-blur-sm rounded-md sm:rounded-lg px-1 ">
              <span class="text-xs text-white uppercase">{{ mediaTypeLabel }}</span>
            </div>
          </div>
        </template>

        <template #content>
          <div class="p-2 default-info">
            <h3 class="font-semibold text-xs sm:text-sm text-white/80 truncate">
              {{ media.title }}
            </h3>
            <div class="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
              <span class="text-xs text-gray-500">{{ year }}</span>
              <span v-if="genreNames.length > 0" class="text-xs text-gray-600">•</span>
              <span v-if="genreNames.length > 0" class="text-xs text-gray-500 truncate">
                {{ genreNames[0] }}
              </span>
            </div>
            <span v-if="media.overview" class="text-xs text-gray-400 line-clamp-2">
                {{ media.overview }}
            </span>
          </div>
        </template>
      </Card>

    </RouterLink>
  </div>
</template>
