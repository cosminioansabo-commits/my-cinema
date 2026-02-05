<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useMediaStore } from '@/stores/mediaStore'
import { useLanguage } from '@/composables/useLanguage'
import type { MediaType, Video, CollectionDetails } from '@/types'
import { getImageUrl, getBackdropUrl, getCollectionDetails } from '@/services/tmdbService'
import { libraryService } from '@/services/libraryService'
import { getExternalRatings, type ExternalRatings } from '@/services/omdbService'
import { progressService, type WatchProgress } from '@/services/progressService'
import type { SonarrEpisode } from '@/services/libraryService'
import TorrentSearchModal from '@/components/torrents/TorrentSearchModal.vue'
import TrailerModal from '@/components/media/TrailerModal.vue'
import PlaybackModal from '@/components/media/PlaybackModal.vue'
import SeasonEpisodes from '@/components/media/SeasonEpisodes.vue'
import OfflineDownloadButton from '@/components/media/OfflineDownloadButton.vue'
import notificationService from '@/services/notificationService'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const router = useRouter()
const mediaStore = useMediaStore()
const toast = useToast()
const { languageChangeCounter, t } = useLanguage()

const showTorrentModal = ref(false)
const showTrailerModal = ref(false)
const showPlaybackModal = ref(false)
const torrentSearchQuery = ref('')
const torrentSearchSeason = ref<number | undefined>()
const torrentSearchEpisode = ref<number | undefined>()

// Library state
const libraryStatus = ref<{ inLibrary: boolean; enabled: boolean; id?: number; hasFile?: boolean }>({ inLibrary: false, enabled: false })
const isAddingToLibrary = ref(false)

// Collection state
const collectionDetails = ref<CollectionDetails | null>(null)
const isLoadingCollection = ref(false)

// External ratings state (OMDb)
const externalRatings = ref<ExternalRatings | null>(null)

// Watch progress state (for Resume button)
const movieProgress = ref<WatchProgress | null>(null)

// TV show progress state (for Resume button)
const showProgress = ref<WatchProgress[]>([])
const sonarrEpisodes = ref<SonarrEpisode[]>([])
const tvPlaybackEpisode = ref<{ season: number; episode: number; title: string } | null>(null)

const mediaType = computed(() => route.params.type as MediaType)
const mediaId = computed(() => Number(route.params.id))

const media = computed(() => mediaStore.currentMedia)
const isLoading = computed(() => mediaStore.isLoadingDetails)

const year = computed(() => {
  if (!media.value?.releaseDate) return ''
  return new Date(media.value.releaseDate).getFullYear()
})

const fetchCollection = async () => {
  if (!media.value?.collection) {
    collectionDetails.value = null
    return
  }

  isLoadingCollection.value = true
  try {
    collectionDetails.value = await getCollectionDetails(media.value.collection.id)
  } catch (error) {
    console.error('Error fetching collection:', error)
    collectionDetails.value = null
  } finally {
    isLoadingCollection.value = false
  }
}

const fetchExternalRatings = async () => {
  if (!media.value?.imdbId) {
    externalRatings.value = null
    return
  }

  try {
    externalRatings.value = await getExternalRatings(media.value.imdbId)
  } catch (error) {
    console.error('Error fetching external ratings:', error)
    externalRatings.value = null
  }
}

const fetchMovieProgress = async () => {
  if (!media.value || mediaType.value !== 'movie') {
    movieProgress.value = null
    return
  }

  try {
    movieProgress.value = await progressService.getMovieProgress(media.value.id)
  } catch (error) {
    console.error('Error fetching movie progress:', error)
    movieProgress.value = null
  }
}

// Computed: has resume data for movie
const hasResumeProgress = computed(() => {
  return movieProgress.value && !movieProgress.value.completed && movieProgress.value.positionMs > 30000
})

// Fetch TV show progress and Sonarr episodes
const fetchShowProgress = async () => {
  if (!media.value || mediaType.value !== 'tv' || !libraryStatus.value.id) {
    showProgress.value = []
    sonarrEpisodes.value = []
    return
  }

  try {
    const [progress, episodes] = await Promise.all([
      progressService.getShowProgress(media.value.id),
      libraryService.getSeriesEpisodes(libraryStatus.value.id)
    ])
    showProgress.value = progress
    sonarrEpisodes.value = episodes
  } catch (error) {
    console.error('Error fetching show progress:', error)
    showProgress.value = []
    sonarrEpisodes.value = []
  }
}

// Computed: get the next episode to resume/play for TV shows
const nextTvEpisode = computed(() => {
  if (mediaType.value !== 'tv' || !libraryStatus.value.inLibrary) return null

  // Get downloaded episodes sorted by season and episode number
  const downloadedEpisodes = sonarrEpisodes.value
    .filter(ep => ep.hasFile && ep.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)

  if (downloadedEpisodes.length === 0) return null

  // First, check for any episode with partial progress (not completed, position > 30s)
  const partialProgress = showProgress.value
    .filter(p => !p.completed && p.positionMs > 30000)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  if (partialProgress.length > 0) {
    const resumeEp = partialProgress[0]
    // Verify this episode is still downloaded
    const isDownloaded = downloadedEpisodes.some(
      ep => ep.seasonNumber === resumeEp.seasonNumber && ep.episodeNumber === resumeEp.episodeNumber
    )
    if (isDownloaded) {
      return {
        seasonNumber: resumeEp.seasonNumber!,
        episodeNumber: resumeEp.episodeNumber!,
        hasProgress: true
      }
    }
  }

  // Find the next unwatched episode (first downloaded episode that's not completed)
  const completedSet = new Set(
    showProgress.value
      .filter(p => p.completed)
      .map(p => `${p.seasonNumber}-${p.episodeNumber}`)
  )

  for (const ep of downloadedEpisodes) {
    const key = `${ep.seasonNumber}-${ep.episodeNumber}`
    if (!completedSet.has(key)) {
      return {
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        hasProgress: false
      }
    }
  }

  // All downloaded episodes are watched - play the first one
  if (downloadedEpisodes.length > 0) {
    return {
      seasonNumber: downloadedEpisodes[0].seasonNumber,
      episodeNumber: downloadedEpisodes[0].episodeNumber,
      hasProgress: false
    }
  }

  return null
})

// Play TV show (opens the next episode to watch)
const playTvShow = () => {
  if (!nextTvEpisode.value || !media.value) return

  const { seasonNumber, episodeNumber } = nextTvEpisode.value
  tvPlaybackEpisode.value = {
    season: seasonNumber,
    episode: episodeNumber,
    title: `${media.value.title} - S${seasonNumber}E${episodeNumber}`
  }
  showPlaybackModal.value = true
}

const checkLibraryStatus = async () => {
  if (!media.value) return

  try {
    if (mediaType.value === 'movie') {
      const result = await libraryService.checkMovieInLibrary(media.value.id)
      libraryStatus.value = {
        inLibrary: result.inLibrary,
        enabled: result.enabled,
        id: result.movie?.id,
        hasFile: result.movie?.hasFile
      }
    } else {
      // For TV shows, we need the external IDs to get TVDB ID
      // For now, try to lookup by TMDB ID
      const series = await libraryService.lookupSeriesByTmdbId(media.value.id)
      if (series) {
        const result = await libraryService.checkSeriesInLibrary(series.tvdbId)
        libraryStatus.value = {
          inLibrary: result.inLibrary,
          enabled: result.enabled,
          id: result.series?.id
        }
      }
    }
  } catch (error) {
    console.error('Error checking library status:', error)
  }
}

const testNotification = () => {
  notificationService.show('My Cinema', media.value?.title || 'Test notification')
}

const toggleLibrary = async () => {
  if (!media.value || isAddingToLibrary.value) return

  isAddingToLibrary.value = true
  try {
    if (libraryStatus.value.inLibrary && libraryStatus.value.id) {
      // Remove from library
      let success = false
      if (mediaType.value === 'movie') {
        success = await libraryService.deleteMovie(libraryStatus.value.id, libraryStatus.value.hasFile)
      } else {
        success = await libraryService.deleteSeries(libraryStatus.value.id, libraryStatus.value.hasFile)
      }

      if (success) {
        libraryStatus.value = { ...libraryStatus.value, inLibrary: false, id: undefined }
        toast.add({
          severity: 'info',
          summary: t('media.removedFromLibrary'),
          detail: t('media.hasBeenRemoved', { title: media.value.title }),
          life: 3000
        })
      }
    } else {
      // Add to library
      if (mediaType.value === 'movie') {
        const movie = await libraryService.addMovie(
          media.value.id,
          media.value.title,
          year.value ? Number(year.value) : undefined
        )
        if (movie) {
          libraryStatus.value = { inLibrary: true, enabled: true, id: movie.id }
          toast.add({
            severity: 'success',
            summary: t('media.addedToLibrary'),
            detail: t('media.hasBeenAddedTo', { title: media.value.title, service: 'Radarr' }),
            life: 3000
          })
        }
      } else {
        // For TV shows, lookup first to get TVDB ID
        const lookup = await libraryService.lookupSeriesByTmdbId(media.value.id)
        if (lookup) {
          const series = await libraryService.addSeries(lookup.tvdbId, media.value.title)
          if (series) {
            libraryStatus.value = { inLibrary: true, enabled: true, id: series.id }
            toast.add({
              severity: 'success',
              summary: t('media.addedToLibrary'),
              detail: t('media.hasBeenAddedTo', { title: media.value.title, service: 'Sonarr' }),
              life: 3000
            })
          }
        } else {
          toast.add({
            severity: 'error',
            summary: t('errors.notFound'),
            detail: t('media.notFoundInSonarr'),
            life: 3000
          })
        }
      }
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: t('media.failedToUpdateLibrary'),
      life: 3000
    })
  } finally {
    isAddingToLibrary.value = false
  }
}

onMounted(() => {
  mediaStore.fetchMediaDetails(mediaType.value, mediaId.value)
})

watch([mediaType, mediaId], ([newType, newId]) => {
  mediaStore.fetchMediaDetails(newType, Number(newId))
  libraryStatus.value = { inLibrary: false, enabled: false }
  collectionDetails.value = null
  externalRatings.value = null
  movieProgress.value = null
  showProgress.value = []
  sonarrEpisodes.value = []
  tvPlaybackEpisode.value = null
  // Scroll to top on navigation
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

// Check library status, fetch collection, external ratings, and progress when media loads
// Run all independent fetches in parallel for better performance
watch(media, (newMedia) => {
  if (newMedia) {
    Promise.all([
      checkLibraryStatus(),
      fetchCollection(),
      fetchExternalRatings(),
      fetchMovieProgress(),
    ])
  }
})

// Fetch show progress once library status is loaded for TV shows
watch(libraryStatus, (newStatus) => {
  if (newStatus.inLibrary && newStatus.id && mediaType.value === 'tv') {
    fetchShowProgress()
  }
})

// Refetch media details when language changes
watch(languageChangeCounter, () => {
  mediaStore.fetchMediaDetails(mediaType.value, mediaId.value)
})

const posterUrl = computed(() => media.value ? getImageUrl(media.value.posterPath, 'w500') : '')
const backdropUrl = computed(() => media.value ? getBackdropUrl(media.value.backdropPath, 'w1280') : '')

const runtime = computed(() => {
  if (!media.value?.runtime) return ''
  const hours = Math.floor(media.value.runtime / 60)
  const minutes = media.value.runtime % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

const ratingPercent = computed(() => {
  if (!media.value) return 0
  return Math.round(media.value.voteAverage * 10)
})

const ratingColor = computed(() => {
  const score = media.value?.voteAverage || 0
  if (score >= 7) return 'text-green-500'
  if (score >= 5) return 'text-yellow-500'
  return 'text-red-500'
})

const directors = computed(() => {
  if (!media.value?.credits?.crew) return []
  return media.value.credits.crew.filter(c => c.job === 'Director' || c.job === 'Creator')
})

const cast = computed(() => {
  return media.value?.credits?.cast || []
})

const seasons = computed(() => {
  return media.value?.seasons || []
})

const trailer = computed((): Video | null => {
  if (!media.value?.videos?.length) return null
  // First video is already the best one (sorted by priority in service)
  return media.value.videos[0]
})

// Handle episode/season torrent search from SeasonEpisodes component
const handleEpisodeTorrentSearch = (query: string, seasonNum?: number, episodeNum?: number) => {
  torrentSearchQuery.value = query
  torrentSearchSeason.value = seasonNum
  torrentSearchEpisode.value = episodeNum
  showTorrentModal.value = true
}

// Handle main Find Torrent button
const handleMainTorrentSearch = () => {
  torrentSearchQuery.value = ''
  torrentSearchSeason.value = undefined
  torrentSearchEpisode.value = undefined
  showTorrentModal.value = true
}

// Recommendations from TMDB (stored in 'similar' field which contains combined recommendations)
const recommendations = computed(() => {
  return media.value?.similar || []
})

// Collection parts excluding current movie
const otherCollectionParts = computed(() => {
  if (!collectionDetails.value?.parts || !media.value) return []
  return collectionDetails.value.parts.filter(part => part.id !== media.value!.id)
})

// Box office formatting
const formatCurrency = (value: number | undefined): string => {
  if (!value || value === 0) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const budget = computed(() => formatCurrency(media.value?.budget))
const revenue = computed(() => formatCurrency(media.value?.revenue))
const profit = computed(() => {
  if (!media.value?.budget || !media.value?.revenue) return ''
  const profitValue = media.value.revenue - media.value.budget
  return formatCurrency(profitValue)
})
const profitIsPositive = computed(() => {
  if (!media.value?.budget || !media.value?.revenue) return true
  return media.value.revenue >= media.value.budget
})

// Has box office data
const hasBoxOffice = computed(() => {
  return mediaType.value === 'movie' && (media.value?.budget || media.value?.revenue)
})

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="-mx-3 sm:-mx-6 lg:-mx-10 -mt-4 sm:-mt-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div class="h-[50vh] bg-[#181818] mb-8">
        <Skeleton width="100%" height="100%" />
      </div>
      <div class="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
        <Skeleton width="250px" height="375px" class="rounded-lg flex-shrink-0" />
        <div class="flex-1 space-y-4">
          <Skeleton height="3rem" width="60%" />
          <Skeleton height="1.5rem" width="40%" />
          <Skeleton height="6rem" />
          <Skeleton height="3rem" width="250px" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="media">
      <!-- Hero Backdrop -->
      <div class="relative h-[40vh] sm:h-[50vh] min-h-[280px] sm:min-h-[400px] max-h-[600px] overflow-hidden">
        <img
          v-if="backdropUrl"
          :src="backdropUrl"
          :alt="media.title"
          class="w-full h-full object-cover object-top"
        />
        <div v-else class="w-full h-full bg-[#181818]"></div>

        <!-- Gradients -->
        <div class="absolute inset-0 hero-gradient"></div>
        <div class="absolute inset-0 hero-gradient-bottom"></div>

        <!-- Back button -->
        <button
          class="absolute top-16 sm:top-20 left-3 sm:left-4 md:left-8 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors z-10"
          @click="goBack"
        >
          <i class="pi pi-arrow-left text-sm sm:text-base"></i>
        </button>
      </div>

      <!-- Main content -->
      <div class="relative z-10 px-3 sm:px-4 md:px-10">
        <div class="max-w-6xl mx-auto">
          <div class="flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8">
            <!-- Poster -->
            <div class="flex-shrink-0 hidden md:block">
              <img
                :src="posterUrl"
                :alt="media.title"
                class="w-64 rounded-lg shadow-2xl"
              />
            </div>

            <!-- Details -->
            <div class="flex-1">
              <!-- Title -->
              <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-shadow mb-2 sm:mb-4">
                {{ media.title }}
              </h1>

              <!-- Meta info -->
              <div class="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4 text-sm sm:text-base">
                <span :class="[ratingColor, 'font-bold']">{{ ratingPercent }}% {{ t('media.match') }}</span>
                <span class="text-gray-400">{{ year }}</span>
                <span v-if="runtime" class="text-gray-400">{{ runtime }}</span>
                <span v-if="media.numberOfSeasons" class="text-gray-400">
                  {{ media.numberOfSeasons }} {{ media.numberOfSeasons > 1 ? t('media.seasons') : t('media.season') }}
                </span>
              </div>

              <!-- Genres -->
              <div class="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                <span
                  v-for="genre in media.genres"
                  :key="genre.id"
                  class="px-2 sm:px-3 py-0.5 sm:py-1 bg-white/10 rounded-full text-xs sm:text-sm text-gray-300"
                >
                  {{ genre.name }}
                </span>
              </div>

              <!-- Actions -->
              <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                <!-- Play/Resume Button (for movies with file) -->
                <Button
                  v-if="mediaType === 'movie' && libraryStatus.inLibrary && libraryStatus.hasFile"
                  :label="hasResumeProgress ? t('media.resume') : t('media.play')"
                  icon="pi pi-play-circle"
                  class="action-btn action-btn-play"
                  @click="showPlaybackModal = true"
                />
                <!-- Play/Resume Button (for TV shows with downloaded episodes) -->
                <Button
                  v-if="mediaType === 'tv' && nextTvEpisode"
                  :label="nextTvEpisode.hasProgress ? t('media.resume') : t('media.play')"
                  icon="pi pi-play-circle"
                  class="action-btn action-btn-play"
                  @click="playTvShow"
                  v-tooltip.bottom="`S${nextTvEpisode.seasonNumber}E${nextTvEpisode.episodeNumber}`"
                />
                <Button
                  v-if="trailer"
                  :label="t('media.trailer')"
                  icon="pi pi-youtube"
                  class="action-btn action-btn-trailer"
                  @click="showTrailerModal = true"
                />
                <Button
                  v-if="libraryStatus.enabled"
                  :label="libraryStatus.inLibrary ? t('media.inLibrary') : t('media.addToLibrary')"
                  :icon="isAddingToLibrary ? 'pi pi-spin pi-spinner' : (libraryStatus.inLibrary ? 'pi pi-check-circle' : 'pi pi-plus-circle')"
                  :class="['action-btn', libraryStatus.inLibrary ? 'action-btn-library-active' : 'action-btn-library']"
                  :disabled="isAddingToLibrary"
                  @click="toggleLibrary"
                />
                <!-- Torrent button: hidden if movie already has file -->
                <Button
                  v-if="libraryStatus.enabled && !(mediaType === 'movie' && libraryStatus.hasFile)"
                  :label="t('media.findTorrent')"
                  icon="pi pi-cloud-download"
                  :class="['action-btn action-btn-torrent', { 'action-btn-disabled': !libraryStatus.inLibrary }]"
                  :disabled="!libraryStatus.inLibrary"
                  :title="!libraryStatus.inLibrary ? t('media.addToLibraryFirst') : t('torrent.searchTitle')"
                  @click="handleMainTorrentSearch"
                />
                <!-- Offline download button (for movies with file) -->
                <OfflineDownloadButton
                  v-if="media && mediaType === 'movie' && libraryStatus.hasFile"
                  :media="media"
                  variant="full"
                />
                <!-- Test notification button -->
                <Button
                  icon="pi pi-bell"
                  text
                  rounded
                  class="!text-gray-400 hover:!text-white hover:!bg-white/10"
                  v-tooltip.bottom="'Test notification'"
                  @click="testNotification"
                />
              </div>

              <!-- style improvements -->
              <div v-if="media.tagline" class="mb-4 sm:mb-6 pl-4 border-l-2 border-purple-500/60">
                <p class="text-gray-300 italic text-sm sm:text-base lg:text-lg leading-relaxed">
                  {{ media.tagline }}
                </p>
              </div>

              <!-- Overview -->
              <div class="mb-4 sm:mb-6">
                <h3 class="text-white text-base sm:text-lg font-semibold mb-2 sm:mb-3">{{ t('media.overview') }}</h3>
                <p class="text-gray-200 text-sm sm:text-base leading-relaxed">
                  {{ media.overview }}
                </p>
              </div>

              <!-- Director/Creator -->
              <div v-if="directors.length > 0" class="mb-4">
                <span class="text-gray-400">{{ mediaType === 'movie' ? t('media.director') : t('media.creator') }}: </span>
                <template v-for="(director, index) in directors" :key="director.id">
                  <RouterLink
                    :to="`/actor/${director.id}`"
                    class="text-white hover:text-purple-400 hover:underline transition-colors"
                  >
                    {{ director.name }}
                  </RouterLink>
                  <span v-if="index < directors.length - 1" class="text-white">, </span>
                </template>
              </div>

              <!-- Box Office (Movies only) -->
              <div v-if="hasBoxOffice" class="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div v-if="budget">
                  <span class="text-gray-400">{{ t('media.budget') }}: </span>
                  <span class="text-white">{{ budget }}</span>
                </div>
                <div v-if="revenue">
                  <span class="text-gray-400">{{ t('media.revenue') }}: </span>
                  <span class="text-white">{{ revenue }}</span>
                </div>
                <div v-if="profit">
                  <span class="text-gray-400">{{ t('media.profit') }}: </span>
                  <span :class="profitIsPositive ? 'text-green-400' : 'text-red-400'">{{ profit }}</span>
                </div>
              </div>

              <!-- External Ratings & Links -->
              <div v-if="media.imdbId || externalRatings" class="flex flex-wrap items-center gap-3">
                <!-- Rotten Tomatoes -->
                <div
                  v-if="externalRatings?.rottenTomatoes"
                  class="h-8 flex items-center gap-2 px-3 bg-zinc-800 rounded"
                  :title="`Rotten Tomatoes: ${externalRatings.rottenTomatoes.rating}%`"
                >
                  <span class="text-base leading-none">🍅</span>
                  <span
                    :class="externalRatings.rottenTomatoes.rating >= 60 ? 'text-red-400' : 'text-green-400'"
                    class="font-bold text-sm"
                  >
                    {{ externalRatings.rottenTomatoes.rating }}%
                  </span>
                </div>

                <!-- Metacritic -->
                <div
                  v-if="externalRatings?.metacritic"
                  class="h-8 flex items-center gap-2 px-3 bg-zinc-800 rounded"
                  :title="`Metacritic: ${externalRatings.metacritic.rating}/100`"
                >
                  <span
                    class="w-5 h-5 flex items-center justify-center text-xs font-bold rounded"
                    :class="[
                      externalRatings.metacritic.rating >= 61 ? 'bg-green-500' :
                      externalRatings.metacritic.rating >= 40 ? 'bg-yellow-500' : 'bg-red-500',
                      'text-white'
                    ]"
                  >
                    {{ externalRatings.metacritic.rating }}
                  </span>
                  <span class="text-gray-400 text-xs">Metacritic</span>
                </div>

                <!-- IMDb Link -->
                <a
                  v-if="media.imdbId"
                  :href="`https://www.imdb.com/title/${media.imdbId}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="h-8 inline-flex items-center gap-2 px-3 bg-[#f5c518] text-black text-sm font-bold rounded hover:bg-[#e0b015] transition-colors"
                >
                  <span>IMDb</span>
                  <span v-if="externalRatings?.imdb" class="text-black/70">{{ externalRatings.imdb.rating.toFixed(1) }}</span>
                  <i class="pi pi-external-link text-xs"></i>
                </a>
              </div>

              <!-- Awards -->
              <div v-if="externalRatings?.awards" class="mt-3 text-sm">
                <span class="text-yellow-500 mr-2">🏆</span>
                <span class="text-gray-300">{{ externalRatings.awards }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Seasons & Episodes Section (TV Shows only) -->
        <section v-if="mediaType === 'tv' && seasons.length > 0" class="mt-8 sm:mt-12 md:mt-16 max-w-6xl mx-auto">
          <h2 class="row-title text-lg sm:text-xl mb-4 sm:mb-6">{{ t('media.seasonsAndEpisodes') }}</h2>
          <SeasonEpisodes
            :tv-id="media.id"
            :seasons="seasons"
            :show-title="media.title"
            :sonarr-series-id="mediaType === 'tv' && libraryStatus.inLibrary ? libraryStatus.id : undefined"
            :media="media"
            @search-torrent="handleEpisodeTorrentSearch"
          />
        </section>

        <!-- Cast Section -->
        <section v-if="cast.length > 0" class="mt-8 sm:mt-12 md:mt-16 max-w-6xl mx-auto">
          <h2 class="row-title text-lg sm:text-xl mb-4 sm:mb-6">{{ t('media.cast') }}</h2>
          <div class="flex gap-3 sm:gap-5 overflow-x-auto pb-4 sm:pb-6 hide-scrollbar">
            <router-link
              v-for="member in cast"
              :key="member.id"
              :to="`/actor/${member.id}`"
              class="flex-shrink-0 w-24 sm:w-30 text-center group cursor-pointer"
            >
              <div class="aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-800 mb-2 sm:mb-3 mx-auto w-24 sm:w-30 shadow-lg shadow-black/30 border border-zinc-700/50 group-hover:border-purple-500/50 transition-all duration-200">
                <img
                  v-if="member.profilePath"
                  :src="getImageUrl(member.profilePath, 'w200')"
                  :alt="member.name"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center bg-zinc-800">
                  <i class="pi pi-user text-2xl sm:text-3xl text-gray-600"></i>
                </div>
              </div>
              <p class="font-semibold text-xs sm:text-sm text-white truncate px-1 group-hover:text-purple-400 transition-colors">{{ member.name }}</p>
              <p class="text-[10px] sm:text-xs text-gray-500 truncate px-1 mt-0.5 sm:mt-1">{{ member.character }}</p>
            </router-link>
          </div>
        </section>

        <!-- Collection Section (Movies only) -->
        <section v-if="collectionDetails && otherCollectionParts.length > 0" class="mt-8 sm:mt-12 md:mt-16 max-w-6xl mx-auto">
          <h2 class="row-title text-lg sm:text-xl mb-4 sm:mb-6">{{ collectionDetails.name }}</h2>
          <div class="flex gap-3 sm:gap-4 overflow-x-auto pb-4 hide-scrollbar">
            <router-link
              v-for="part in otherCollectionParts"
              :key="part.id"
              :to="`/media/movie/${part.id}`"
              class="flex-shrink-0 w-28 sm:w-40 group cursor-pointer"
            >
              <div class="aspect-2/3 rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800 mb-2 sm:mb-3 shadow-lg shadow-black/30 border border-zinc-700/50 group-hover:border-purple-500/50 transition-all duration-200">
                <img
                  v-if="part.posterPath"
                  :src="getImageUrl(part.posterPath, 'w300')"
                  :alt="part.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <i class="pi pi-video text-2xl sm:text-4xl text-gray-600"></i>
                </div>
              </div>
              <p class="font-medium text-xs sm:text-sm text-white truncate">{{ part.title }}</p>
              <p class="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {{ part.releaseDate?.slice(0, 4) || 'TBA' }}
              </p>
            </router-link>
          </div>
        </section>

        <!-- Recommendations Section -->
        <section v-if="recommendations.length > 0" class="mt-8 sm:mt-12 md:mt-16 max-w-6xl mx-auto">
          <h2 class="row-title text-lg sm:text-xl mb-4 sm:mb-6">{{ t('media.moreLikeThis') }}</h2>
          <div class="flex gap-3 sm:gap-4 overflow-x-auto pb-4 hide-scrollbar">
            <router-link
              v-for="item in recommendations"
              :key="`${item.mediaType}-${item.id}`"
              :to="`/media/${item.mediaType}/${item.id}`"
              class="flex-shrink-0 w-28 sm:w-40 group cursor-pointer"
            >
              <div class="aspect-2/3 rounded-lg sm:rounded-xl overflow-hidden bg-zinc-800 mb-2 sm:mb-3 shadow-lg shadow-black/30 border border-zinc-700/50 group-hover:border-purple-500/50 transition-all duration-200">
                <img
                  v-if="item.posterPath"
                  :src="getImageUrl(item.posterPath, 'w300')"
                  :alt="item.title"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <i class="pi pi-video text-2xl sm:text-4xl text-gray-600"></i>
                </div>
              </div>
              <p class="font-medium text-xs sm:text-sm text-white truncate">{{ item.title }}</p>
              <p class="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {{ item.releaseDate?.slice(0, 4) || '' }}
              </p>
            </router-link>
          </div>
        </section>

      </div>
    </div>

    <!-- Torrent Search Modal -->
    <TorrentSearchModal
      v-if="media"
      v-model:visible="showTorrentModal"
      :title="media.title"
      :english-title="media.englishTitle"
      :year="year ? Number(year) : undefined"
      :media-type="mediaType"
      :media-id="media.id"
      :custom-query="torrentSearchQuery || undefined"
    />

    <!-- Trailer Modal -->
    <TrailerModal
      v-if="media"
      v-model:visible="showTrailerModal"
      :video="trailer"
      :title="media.title"
    />

    <!-- Playback Modal (for movies) -->
    <PlaybackModal
      v-if="media && mediaType === 'movie'"
      v-model:visible="showPlaybackModal"
      :tmdb-id="media.id"
      media-type="movie"
      :title="media.title"
    />

    <!-- Playback Modal (for TV shows) -->
    <PlaybackModal
      v-if="media && mediaType === 'tv' && tvPlaybackEpisode"
      v-model:visible="showPlaybackModal"
      media-type="tv"
      :show-tmdb-id="media.id"
      :season-number="tvPlaybackEpisode.season"
      :episode-number="tvPlaybackEpisode.episode"
      :title="tvPlaybackEpisode.title"
    />
  </div>
</template>

<style scoped>
/* Base action button styles */
.action-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em;
  border: none !important;
  border-radius: 9999px !important;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  overflow: hidden;
}

@media (min-width: 640px) {
  .action-btn {
    padding: 0.75rem 1.5rem !important;
    font-size: 0.875rem !important;
  }
}

/* Play button - Primary CTA with vibrant gradient */
.action-btn-play {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%) !important;
  color: white !important;
  box-shadow:
    0 4px 14px rgba(34, 197, 94, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}

.action-btn-play::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.action-btn-play:hover {
  background: linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%) !important;
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 8px 24px rgba(34, 197, 94, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.action-btn-play:hover::before {
  opacity: 1;
}

.action-btn-play:active {
  transform: translateY(0) scale(0.98);
}

.action-btn-play :deep(.p-button-icon) {
  font-size: 1.125rem;
}

/* Trailer button - YouTube-inspired with red accent */
.action-btn-trailer {
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%) !important;
  color: white !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.action-btn-trailer:hover {
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
  transform: translateY(-2px);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.action-btn-trailer:active {
  transform: translateY(0);
}

.action-btn-trailer :deep(.pi-youtube) {
  color: #ef4444 !important;
  font-size: 1.125rem;
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
}

/* Library button - Add to library state */
.action-btn-library {
  background: transparent !important;
  color: white !important;
  border: 2px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}

.action-btn-library:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3) !important;
}

.action-btn-library:active {
  transform: translateY(0);
}

.action-btn-library :deep(.p-button-icon) {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
}

/* Library button - In library state (success) */
.action-btn-library-active {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.15) 100%) !important;
  color: #4ade80 !important;
  border: 2px solid rgba(34, 197, 94, 0.4) !important;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15) !important;
}

.action-btn-library-active:hover {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.25) 100%) !important;
  border-color: rgba(34, 197, 94, 0.6) !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.25) !important;
}

.action-btn-library-active :deep(.p-button-icon) {
  color: #4ade80 !important;
}

/* Torrent/Download button - Purple accent */
.action-btn-torrent {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%) !important;
  color: white !important;
  box-shadow:
    0 4px 14px rgba(124, 58, 237, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}

.action-btn-torrent:hover:not(.action-btn-disabled) {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%) !important;
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(124, 58, 237, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.action-btn-torrent:active:not(.action-btn-disabled) {
  transform: translateY(0);
}

.action-btn-torrent :deep(.p-button-icon) {
  font-size: 1rem;
}

/* Disabled state for torrent button */
.action-btn-disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
  box-shadow: none !important;
}

.action-btn-disabled:hover {
  transform: none !important;
}
</style>
