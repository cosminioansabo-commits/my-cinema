<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { profileLibraryService, type ProfileLibraryEntry } from '@/services/libraryService'
import { getImageUrl, getPosterPath } from '@/services/tmdbService'
import { useAuthStore } from '@/stores/authStore'
import { useLanguage } from '@/composables/useLanguage'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useLanguage()

// Filter and sort state
type FilterType = 'all' | 'movies' | 'tvShows'
const activeFilter = ref<FilterType>('all')
const sortBy = ref<'added' | 'title' | 'year'>('added')

const sortOptions = computed(() => [
  { label: t('library.sortDateAdded'), value: 'added' },
  { label: t('library.sortTitle'), value: 'title' },
  { label: t('library.sortYear'), value: 'year' }
])

// Library state
const libraryEntries = ref<ProfileLibraryEntry[]>([])
const isLoadingLibrary = ref(true)

const profileId = computed(() => authStore.activeProfileId || 'default')

const fetchLibrary = async () => {
  isLoadingLibrary.value = true
  try {
    libraryEntries.value = await profileLibraryService.getLibrary(profileId.value)
    // Resolve missing poster paths from TMDB in background
    resolveMissingPosters()
  } catch (error) {
    console.error('Error fetching library:', error)
  } finally {
    isLoadingLibrary.value = false
  }
}

/**
 * For library entries missing posterPath, fetch from TMDB and update locally.
 * Also persists the poster path to the backend so it doesn't need to be fetched again.
 */
const resolveMissingPosters = async () => {
  const entriesMissingPoster = libraryEntries.value.filter(e => !e.posterPath && e.tmdbId)
  if (entriesMissingPoster.length === 0) return

  console.log(`Resolving ${entriesMissingPoster.length} missing poster paths from TMDB...`)

  // Fetch posters in parallel (batches of 5 to avoid rate limits)
  const batchSize = 5
  for (let i = 0; i < entriesMissingPoster.length; i += batchSize) {
    const batch = entriesMissingPoster.slice(i, i + batchSize)
    await Promise.all(batch.map(async (entry) => {
      try {
        const posterPath = await getPosterPath(entry.mediaType, entry.tmdbId)
        if (posterPath) {
          // Update local state reactively
          entry.posterPath = posterPath
          // Persist to backend in background (fire-and-forget)
          profileLibraryService.updatePosterPath(profileId.value, entry.mediaType, entry.tmdbId, posterPath).catch(() => {})
        }
      } catch (error) {
        // Silent fail — poster will just show placeholder
      }
    }))
  }
}

const libraryMovies = computed(() => libraryEntries.value.filter(e => e.mediaType === 'movie'))
const librarySeries = computed(() => libraryEntries.value.filter(e => e.mediaType === 'tv'))
const totalLibraryItems = computed(() => libraryEntries.value.length)

// Sorted movies
const sortedMovies = computed(() => {
  const movies = [...libraryMovies.value]
  switch (sortBy.value) {
    case 'added':
      return movies.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    case 'title':
      return movies.sort((a, b) => a.title.localeCompare(b.title))
    case 'year':
      return movies.sort((a, b) => (b.year || 0) - (a.year || 0))
    default:
      return movies
  }
})

// Sorted series
const sortedSeries = computed(() => {
  const series = [...librarySeries.value]
  switch (sortBy.value) {
    case 'added':
      return series.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    case 'title':
      return series.sort((a, b) => a.title.localeCompare(b.title))
    case 'year':
      return series.sort((a, b) => (b.year || 0) - (a.year || 0))
    default:
      return series
  }
})

// Show based on filter
const showMovies = computed(() => activeFilter.value === 'all' || activeFilter.value === 'movies')
const showTvShows = computed(() => activeFilter.value === 'all' || activeFilter.value === 'tvShows')

const getPoster = (entry: ProfileLibraryEntry) => {
  if (entry.posterPath) {
    return getImageUrl(entry.posterPath, 'w300')
  }
  return ''
}

const goToMedia = (entry: ProfileLibraryEntry) => {
  router.push(`/media/${entry.mediaType}/${entry.tmdbId}`)
}

onMounted(() => {
  fetchLibrary()
})

// Re-fetch library when the active profile changes
watch(profileId, () => {
  fetchLibrary()
})
</script>

<template>
  <div class="max-w-7xl mx-auto py-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
      <div>
        <div class="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          <div class="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <i class="pi pi-database text-lg sm:text-2xl text-white"></i>
          </div>
          <h1 class="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {{ t('library.title') }}
          </h1>
        </div>
        <p class="text-gray-400 text-sm sm:text-lg ml-0 sm:ml-[4.5rem]">{{ t('library.subtitle') }}</p>
      </div>
    </div>

    <!-- Filter Tabs & Sort -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-8 sm:mb-12">
      <!-- Filter Tabs (Stats Bar) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 flex-1">
        <button
          v-ripple
          role="tab"
          :aria-selected="activeFilter === 'all'"
          @click="activeFilter = 'all'"
          class="text-left rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all duration-200 relative overflow-hidden"
          :class="activeFilter === 'all'
            ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/30'
            : 'bg-zinc-900/60 backdrop-blur-sm border-zinc-800/50 hover:border-zinc-700'"
        >
          <div class="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <i class="pi pi-database text-amber-500 text-xs sm:text-sm"></i>
            <span class="text-gray-400 text-[10px] sm:text-sm">{{ t('library.total') }}</span>
          </div>
          <p class="text-xl sm:text-3xl font-bold text-white">{{ totalLibraryItems }}</p>
        </button>
        <button
          v-ripple
          role="tab"
          :aria-selected="activeFilter === 'movies'"
          @click="activeFilter = 'movies'"
          class="text-left rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all duration-200 relative overflow-hidden"
          :class="activeFilter === 'movies'
            ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30'
            : 'bg-zinc-900/60 backdrop-blur-sm border-zinc-800/50 hover:border-zinc-700'"
        >
          <div class="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <i class="pi pi-video text-blue-400 text-xs sm:text-sm"></i>
            <span class="text-gray-400 text-[10px] sm:text-sm">{{ t('library.movies') }}</span>
          </div>
          <p class="text-xl sm:text-3xl font-bold text-white">{{ libraryMovies.length }}</p>
        </button>
        <button
          v-ripple
          role="tab"
          :aria-selected="activeFilter === 'tvShows'"
          @click="activeFilter = 'tvShows'"
          class="text-left rounded-xl sm:rounded-2xl p-3 sm:p-5 border transition-all duration-200 relative overflow-hidden"
          :class="activeFilter === 'tvShows'
            ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
            : 'bg-zinc-900/60 backdrop-blur-sm border-zinc-800/50 hover:border-zinc-700'"
        >
          <div class="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <i class="pi pi-desktop text-purple-400 text-xs sm:text-sm"></i>
            <span class="text-gray-400 text-[10px] sm:text-sm">{{ t('library.tvShows') }}</span>
          </div>
          <p class="text-xl sm:text-3xl font-bold text-white">{{ librarySeries.length }}</p>
        </button>
      <div class="flex items-center gap-2 sm:self-end justify-center h-full">
        <i class="pi pi-sort-alt text-gray-400 text-sm"></i>
        <Select
          v-model="sortBy"
          :options="sortOptions"
          optionLabel="label"
          optionValue="value"
          class="w-40 sm:w-48"
        />
      </div>
      </div>

      <!-- Sort Dropdown -->
    </div>

    <!-- Loading state -->
    <div v-if="isLoadingLibrary" class="flex items-center justify-center py-16 sm:py-24">
      <ProgressSpinner class="!w-[50px] !h-[50px]" strokeWidth="4" />
    </div>

    <!-- Library content -->
    <template v-else-if="libraryEntries.length > 0">
      <!-- Movies -->
      <section v-if="showMovies && sortedMovies.length > 0" class="mb-8 sm:mb-12">
        <div class="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div class="w-1 h-6 sm:h-8 bg-blue-500 rounded-full"></div>
          <h2 class="text-lg sm:text-2xl font-bold text-white">{{ t('library.movies') }}</h2>
          <span class="text-gray-500 text-xs sm:text-sm">({{ sortedMovies.length }})</span>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-4">
          <div
            v-for="entry in sortedMovies"
            :key="entry.id"
            class="group cursor-pointer"
            @click="goToMedia(entry)"
          >
            <div class="relative aspect-2/3 rounded-md sm:rounded-lg overflow-hidden bg-zinc-800 mb-1.5 sm:mb-2">
              <img
                v-if="getPoster(entry)"
                :src="getPoster(entry)"
                :alt="entry.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <i class="pi pi-video text-2xl sm:text-4xl text-gray-600"></i>
              </div>
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <i class="pi pi-play text-white text-lg sm:text-2xl"></i>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-white truncate">{{ entry.title }}</p>
            <p class="text-[10px] sm:text-xs text-gray-500">{{ entry.year }}</p>
          </div>
        </div>
      </section>

      <!-- TV Shows -->
      <section v-if="showTvShows && sortedSeries.length > 0" class="mb-8 sm:mb-12">
        <div class="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div class="w-1 h-6 sm:h-8 bg-purple-500 rounded-full"></div>
          <h2 class="text-lg sm:text-2xl font-bold text-white">{{ t('library.tvShows') }}</h2>
          <span class="text-gray-500 text-xs sm:text-sm">({{ sortedSeries.length }})</span>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-4">
          <div
            v-for="entry in sortedSeries"
            :key="entry.id"
            class="group cursor-pointer"
            @click="goToMedia(entry)"
          >
            <div class="relative aspect-2/3 rounded-md sm:rounded-lg overflow-hidden bg-zinc-800 mb-1.5 sm:mb-2">
              <img
                v-if="getPoster(entry)"
                :src="getPoster(entry)"
                :alt="entry.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <i class="pi pi-desktop text-2xl sm:text-4xl text-gray-600"></i>
              </div>
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <i class="pi pi-play text-white text-lg sm:text-2xl"></i>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-white truncate">{{ entry.title }}</p>
            <p class="text-[10px] sm:text-xs text-gray-500">{{ entry.year }}</p>
          </div>
        </div>
      </section>
    </template>

    <!-- Empty library state -->
    <div v-else class="bg-zinc-900/40 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-zinc-800/50 p-6 sm:p-12 text-center">
      <div class="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-zinc-800/80 flex items-center justify-center mb-4 sm:mb-8 mx-auto">
        <i class="pi pi-database text-3xl sm:text-5xl text-gray-500"></i>
      </div>
      <h3 class="text-lg sm:text-2xl font-bold text-white mb-2 sm:mb-3">{{ t('library.empty') }}</h3>
      <p class="text-gray-400 max-w-md mx-auto text-sm sm:text-lg">
        {{ t('library.addContent') }}
      </p>
    </div>
  </div>
</template>
