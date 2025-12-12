<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/listsStore'
import { libraryService, type RadarrMovie, type SonarrSeries } from '@/services/libraryService'
import { findByExternalId } from '@/services/tmdbService'
import ListCard from '@/components/lists/ListCard.vue'
import CreateListModal from '@/components/lists/CreateListModal.vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

const router = useRouter()
const listsStore = useListsStore()

const showCreateModal = ref(false)

// Library state
const libraryMovies = ref<RadarrMovie[]>([])
const librarySeries = ref<SonarrSeries[]>([])
const isLoadingLibrary = ref(true)
const libraryEnabled = ref({ radarr: false, sonarr: false })

const handleListCreated = (listId: string) => {
  console.log('Created list:', listId)
}

const fetchLibrary = async () => {
  isLoadingLibrary.value = true
  try {
    const status = await libraryService.getStatus()
    libraryEnabled.value = {
      radarr: status.radarr.connected,
      sonarr: status.sonarr.connected
    }

    const [movies, series] = await Promise.all([
      status.radarr.connected ? libraryService.getMovies() : Promise.resolve([]),
      status.sonarr.connected ? libraryService.getSeries() : Promise.resolve([])
    ])

    libraryMovies.value = movies
    librarySeries.value = series
  } catch (error) {
    console.error('Error fetching library:', error)
  } finally {
    isLoadingLibrary.value = false
  }
}

const totalLibraryItems = computed(() => libraryMovies.value.length + librarySeries.value.length)

const RADARR_URL = 'http://localhost:7878'
const SONARR_URL = 'http://localhost:8989'

const getRadarrPoster = (movie: RadarrMovie) => {
  const poster = movie.images.find(img => img.coverType === 'poster')
  if (!poster?.url) return ''
  // If it's a relative URL, prepend Radarr URL
  if (poster.url.startsWith('/')) {
    return `${RADARR_URL}${poster.url}`
  }
  return poster.url
}

const getSonarrPoster = (series: SonarrSeries) => {
  const poster = series.images.find(img => img.coverType === 'poster')
  if (!poster?.url) return ''
  // If it's a relative URL, prepend Sonarr URL
  if (poster.url.startsWith('/')) {
    return `${SONARR_URL}${poster.url}`
  }
  return poster.url
}

const goToMovie = (tmdbId: number) => {
  router.push(`/media/movie/${tmdbId}`)
}

const goToSeries = async (tvdbId: number) => {
  // Sonarr uses TVDB IDs, we need to convert to TMDB ID
  const result = await findByExternalId(tvdbId, 'tvdb_id')
  if (result) {
    router.push(`/media/tv/${result.id}`)
  } else {
    console.error('Could not find TMDB ID for TVDB:', tvdbId)
  }
}

onMounted(() => {
  fetchLibrary()
})
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
      <div>
        <div class="flex items-center gap-4 mb-3">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e50914] to-[#b20710] flex items-center justify-center shadow-lg shadow-[#e50914]/20">
            <i class="pi pi-list text-2xl text-white"></i>
          </div>
          <h1 class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            My Lists
          </h1>
        </div>
        <p class="text-gray-400 text-lg ml-0 sm:ml-[4.5rem]">Organize your favorite movies and TV shows</p>
      </div>
      <Button
        label="New List"
        icon="pi pi-plus"
        class="self-start sm:self-auto"
        @click="showCreateModal = true"
      />
    </div>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-12">
      <div class="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-database text-amber-500"></i>
          <span class="text-gray-400 text-sm">In Library</span>
        </div>
        <p class="text-3xl font-bold text-white">{{ totalLibraryItems }}</p>
      </div>
      <div class="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-folder text-[#e50914]"></i>
          <span class="text-gray-400 text-sm">Total Lists</span>
        </div>
        <p class="text-3xl font-bold text-white">{{ listsStore.lists.length }}</p>
      </div>
      <div class="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-video text-purple-500"></i>
          <span class="text-gray-400 text-sm">Total Items</span>
        </div>
        <p class="text-3xl font-bold text-white">{{ listsStore.lists.reduce((acc, l) => acc + l.items.length, 0) }}</p>
      </div>
      <div class="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-bookmark text-blue-500"></i>
          <span class="text-gray-400 text-sm">Want to Watch</span>
        </div>
        <p class="text-3xl font-bold text-white">{{ listsStore.getListById('want-to-watch')?.items.length || 0 }}</p>
      </div>
      <div class="bg-zinc-900/60 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-check-circle text-green-500"></i>
          <span class="text-gray-400 text-sm">Watched</span>
        </div>
        <p class="text-3xl font-bold text-white">{{ listsStore.getListById('watched')?.items.length || 0 }}</p>
      </div>
    </div>

    <!-- Library Section -->
    <section v-if="libraryEnabled.radarr || libraryEnabled.sonarr" class="mb-12">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-1 h-8 bg-amber-500 rounded-full"></div>
        <h2 class="text-2xl font-bold text-white">My Library</h2>
        <span class="text-gray-500 text-sm">(Radarr/Sonarr)</span>
      </div>

      <!-- Loading state -->
      <div v-if="isLoadingLibrary" class="flex items-center justify-center py-12">
        <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
      </div>

      <!-- Library content -->
      <div v-else>
        <!-- Movies from Radarr -->
        <div v-if="libraryMovies.length > 0" class="mb-8">
          <h3 class="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <i class="pi pi-video text-blue-400"></i>
            Movies ({{ libraryMovies.length }})
          </h3>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            <div
              v-for="movie in libraryMovies"
              :key="movie.id"
              class="group cursor-pointer"
              @click="goToMovie(movie.tmdbId)"
            >
              <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 mb-2">
                <img
                  v-if="getRadarrPoster(movie)"
                  :src="getRadarrPoster(movie)"
                  :alt="movie.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <i class="pi pi-video text-4xl text-gray-600"></i>
                </div>
                <!-- Downloaded indicator -->
                <div v-if="movie.hasFile" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <i class="pi pi-check text-white text-xs"></i>
                </div>
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <i class="pi pi-play text-white text-2xl"></i>
                </div>
              </div>
              <p class="text-sm text-white truncate">{{ movie.title }}</p>
              <p class="text-xs text-gray-500">{{ movie.year }}</p>
            </div>
          </div>
        </div>

        <!-- TV Shows from Sonarr -->
        <div v-if="librarySeries.length > 0">
          <h3 class="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <i class="pi pi-desktop text-purple-400"></i>
            TV Shows ({{ librarySeries.length }})
          </h3>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            <div
              v-for="series in librarySeries"
              :key="series.id"
              class="group cursor-pointer"
              @click="goToSeries(series.tvdbId)"
            >
              <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 mb-2">
                <img
                  v-if="getSonarrPoster(series)"
                  :src="getSonarrPoster(series)"
                  :alt="series.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <i class="pi pi-desktop text-4xl text-gray-600"></i>
                </div>
                <!-- Progress indicator -->
                <div v-if="series.statistics" class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                  <div
                    class="h-full bg-green-500"
                    :style="{ width: `${series.statistics.percentOfEpisodes}%` }"
                  ></div>
                </div>
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <i class="pi pi-play text-white text-2xl"></i>
                </div>
              </div>
              <p class="text-sm text-white truncate">{{ series.title }}</p>
              <p class="text-xs text-gray-500">{{ series.year }} • {{ series.statistics?.seasonCount || 0 }} seasons</p>
            </div>
          </div>
        </div>

        <!-- Empty library state -->
        <div v-if="libraryMovies.length === 0 && librarySeries.length === 0" class="text-center py-8">
          <i class="pi pi-database text-4xl text-gray-600 mb-4"></i>
          <p class="text-gray-400">Your library is empty. Add movies and TV shows from their detail pages.</p>
        </div>
      </div>
    </section>

    <!-- Default Lists -->
    <section class="mb-12">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-1 h-8 bg-[#e50914] rounded-full"></div>
        <h2 class="text-2xl font-bold text-white">Your Lists</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <ListCard
          v-for="list in listsStore.defaultLists"
          :key="list.id"
          :list="list"
        />
      </div>
    </section>

    <!-- Custom Lists -->
    <section v-if="listsStore.customLists.length > 0" class="mb-12">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-1 h-8 bg-purple-500 rounded-full"></div>
        <h2 class="text-2xl font-bold text-white">Custom Lists</h2>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <ListCard
          v-for="list in listsStore.customLists"
          :key="list.id"
          :list="list"
        />
      </div>
    </section>

    <!-- Empty custom lists state -->
    <section v-else class="mt-8">
      <div class="bg-zinc-900/40 backdrop-blur-sm rounded-3xl border border-zinc-800/50 p-12 text-center">
        <div class="w-24 h-24 rounded-3xl bg-zinc-800/80 flex items-center justify-center mb-8 mx-auto">
          <i class="pi pi-folder-open text-5xl text-gray-500"></i>
        </div>
        <h3 class="text-2xl font-bold text-white mb-3">No custom lists yet</h3>
        <p class="text-gray-400 mb-8 max-w-md mx-auto text-lg">
          Create custom lists to organize your content exactly the way you want
        </p>
        <Button
          label="Create Your First List"
          icon="pi pi-plus"
          size="large"
          @click="showCreateModal = true"
        />
      </div>
    </section>

    <!-- Create Modal -->
    <CreateListModal
      v-model:visible="showCreateModal"
      @created="handleListCreated"
    />
  </div>
</template>
