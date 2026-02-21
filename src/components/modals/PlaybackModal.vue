<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import Dialog from 'primevue/dialog'
import VideoPlayer from '@/components/media/VideoPlayer.vue'
import NextEpisodeCountdown from '@/components/media/player/NextEpisodeCountdown.vue'
import { mediaService, type PlaybackInfo } from '@/services/mediaService'
import { progressService } from '@/services/progressService'
import { useNextEpisode } from '@/composables/useNextEpisode'
import { useModalState } from '@/composables/useModalState'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import type { OfflineMediaItem } from '@/services/offlineStorageService'

const props = defineProps<{
  visible: boolean
  tmdbId?: number
  mediaType: 'movie' | 'tv'
  // For TV episodes
  seasonNumber?: number
  episodeNumber?: number
  showTmdbId?: number
  // Display info
  title: string
  // Offline playback
  offlineItem?: OfflineMediaItem
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const isOpen = useModalState(props, emit)
const offlineStore = useOfflineStore()
const { t } = useLanguage()

const isLoading = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const playbackInfo = ref<PlaybackInfo | null>(null)
const resumePosition = ref(0)
// Next episode composable
const {
  nextEpisode,
  showNextEpisodeCountdown,
  countdownSeconds,
  fetchNextEpisode: fetchNextEpisodeFromComposable,
  startCountdown,
  cancelCountdown: cancelCountdownFromComposable,
  reset: resetNextEpisode
} = useNextEpisode()

// Current episode state for auto-play
const currentSeasonNumber = ref(props.seasonNumber)
const currentEpisodeNumber = ref(props.episodeNumber)

// Get the effective TMDB ID for progress tracking
const effectiveTmdbId = computed(() => {
  return props.mediaType === 'movie' ? props.tmdbId : props.showTmdbId
})

// Fetch next episode info for TV shows
const fetchNextEpisodeInfo = async () => {
  if (props.mediaType !== 'tv' || !props.showTmdbId || !currentSeasonNumber.value || !currentEpisodeNumber.value) {
    return
  }
  await fetchNextEpisodeFromComposable(props.showTmdbId, currentSeasonNumber.value, currentEpisodeNumber.value)
}

// Fetch playback info and saved progress when modal opens
const fetchPlaybackInfo = async () => {
  if (!props.visible) return

  isLoading.value = true
  hasError.value = false
  playbackInfo.value = null
  resumePosition.value = 0
  resetNextEpisode()

  try {
    // Offline mode - get video URL from cache
    if (props.offlineItem) {
      // Fetch video URL and subtitles in parallel
      const [offlineVideoUrl, offlineSubtitles] = await Promise.all([
        offlineStore.getOfflineVideoUrl(props.offlineItem.id),
        offlineStore.getOfflineSubtitles(props.offlineItem.id),
      ])

      if (!offlineVideoUrl) {
        hasError.value = true
        errorMessage.value = t('player.offlineNotFound')
        return
      }

      // Create playback info from offline item
      playbackInfo.value = {
        found: true,
        streamUrl: offlineVideoUrl,
        title: props.offlineItem.episodeTitle
          ? `${props.offlineItem.title} - S${props.offlineItem.seasonNumber}E${props.offlineItem.episodeNumber} - ${props.offlineItem.episodeTitle}`
          : props.offlineItem.title,
        duration: props.offlineItem.duration * 1000, // Convert seconds to ms
        subtitles: offlineSubtitles,
        audioTracks: [],
      }

      // Resume from saved position in offline item
      if (props.offlineItem.playbackPosition && props.offlineItem.playbackPosition > 0) {
        resumePosition.value = props.offlineItem.playbackPosition * 1000 // Convert seconds to ms
      }

      return
    }

    // Online mode - fetch from Jellyfin
    // Fetch playback info and saved progress in parallel
    const [playbackResult, savedProgress] = await Promise.all([
      props.mediaType === 'movie' && props.tmdbId
        ? mediaService.getMoviePlayback(props.tmdbId)
        : props.mediaType === 'tv' && props.showTmdbId && currentSeasonNumber.value && currentEpisodeNumber.value
          ? mediaService.getEpisodePlayback(props.showTmdbId, currentSeasonNumber.value, currentEpisodeNumber.value)
          : Promise.resolve(null),
      effectiveTmdbId.value
        ? props.mediaType === 'movie'
          ? progressService.getMovieProgress(effectiveTmdbId.value)
          : currentSeasonNumber.value && currentEpisodeNumber.value
            ? progressService.getEpisodeProgress(effectiveTmdbId.value, currentSeasonNumber.value, currentEpisodeNumber.value)
            : Promise.resolve(null)
        : Promise.resolve(null)
    ])

    playbackInfo.value = playbackResult

    // Set resume position from saved progress (if not already completed)
    if (savedProgress && !savedProgress.completed && savedProgress.positionMs > 0) {
      resumePosition.value = savedProgress.positionMs
    }

    if (!playbackInfo.value) {
      hasError.value = true
      errorMessage.value = t('player.mediaNotFound')
    } else {
      // Fetch next episode info for TV shows
      fetchNextEpisodeInfo()
    }
  } catch (error) {
    console.error('Error fetching playback info:', error)
    hasError.value = true
    errorMessage.value = t('player.failedToConnect')
  } finally {
    isLoading.value = false
  }
}

// Save progress to backend database (or offline store for offline playback)
// Called every 10 seconds by VideoPlayer interval, and on pause/stop
const handleProgress = async (timeMs: number, state: 'playing' | 'paused' | 'stopped') => {
  if (!playbackInfo.value?.duration) return

  const durationMs = playbackInfo.value.duration

  // For offline playback, save progress to offline store
  if (props.offlineItem) {
    const positionSeconds = timeMs / 1000
    await offlineStore.updatePlaybackPosition(props.offlineItem.id, positionSeconds)
    return
  }

  // Online playback - save to backend
  if (!effectiveTmdbId.value) return

  const progressType = props.mediaType === 'movie' ? 'movie' : 'episode'

  await progressService.saveProgress(
    progressType,
    effectiveTmdbId.value,
    timeMs,
    durationMs,
    currentSeasonNumber.value,
    currentEpisodeNumber.value
  )
}

// Handle close - confirm if playing
const handleClose = () => {
  // Just close for now, VideoPlayer handles its own progress reporting on unmount
  isOpen.value = false
}

// Cancel countdown and close
const cancelCountdown = () => {
  cancelCountdownFromComposable()
  isOpen.value = false
}

// Play next episode
const playNextEpisode = async () => {
  if (!nextEpisode.value || !props.showTmdbId) {
    cancelCountdown()
    return
  }

  // Update current episode state
  currentSeasonNumber.value = nextEpisode.value.seasonNumber
  currentEpisodeNumber.value = nextEpisode.value.episodeNumber

  // Reset and refetch playback info for next episode
  resetNextEpisode()
  await fetchPlaybackInfo()
}

// Handle video ended - mark as watched and show next episode countdown or close
const handleEnded = async () => {
  // Mark as fully watched
  if (effectiveTmdbId.value && playbackInfo.value?.duration) {
    const progressType = props.mediaType === 'movie' ? 'movie' : 'episode'
    await progressService.markAsWatched(
      progressType,
      effectiveTmdbId.value,
      playbackInfo.value.duration,
      currentSeasonNumber.value,
      currentEpisodeNumber.value
    )
  }

  // For TV shows with a next episode, show countdown
  if (props.mediaType === 'tv' && nextEpisode.value) {
    startCountdown(playNextEpisode)
  } else {
    // For movies or shows without next episode, close after a delay
    setTimeout(() => {
      isOpen.value = false
    }, 2000)
  }
}

// Watch for modal open - use immediate: true in case component mounts with visible=true
watch(() => props.visible, (newValue) => {
  if (newValue) {
    // Reset episode state when modal opens
    currentSeasonNumber.value = props.seasonNumber
    currentEpisodeNumber.value = props.episodeNumber
    fetchPlaybackInfo()
  } else {
    // Cleanup when closing
    resetNextEpisode()
    playbackInfo.value = null
  }
}, { immediate: true })

// Cleanup on unmount
onUnmounted(() => {
  resetNextEpisode()
  playbackInfo.value = null
})

// Display title
const displayTitle = computed(() => {
  if (playbackInfo.value?.title) {
    return playbackInfo.value.title
  }
  return props.title
})
</script>

<template>
  <Dialog
    v-model:visible="isOpen"
    :header="displayTitle"
    modal
    dismissableMask
    :closable="true"
    :pt="{
      root: { class: 'playback-dialog' },
      mask: { class: 'backdrop-blur-sm bg-black/90' },
      header: { class: 'playback-dialog-header' },
      content: { class: 'playback-dialog-content' }
    }"
    @hide="handleClose"
  >
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center h-[60vh]">
      <i class="pi pi-spin pi-spinner text-5xl text-white mb-4"></i>
      <p class="text-gray-400">{{ t('player.loadingPlayback') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="hasError" class="flex flex-col items-center justify-center h-[60vh]">
      <i class="pi pi-exclamation-triangle text-5xl text-red-500 mb-4"></i>
      <p class="text-white text-lg mb-2">{{ t('player.unableToPlay') }}</p>
      <p class="text-gray-400 text-center max-w-md">{{ errorMessage }}</p>
    </div>

    <!-- Video Player -->
    <div v-else-if="playbackInfo && playbackInfo.streamUrl" class="h-[80vh] relative">
      <VideoPlayer
        :stream-url="playbackInfo.streamUrl"
        :title="displayTitle"
        :resume-position="resumePosition"
        :duration="playbackInfo.duration"
        :subtitles="playbackInfo.subtitles"
        :audio-tracks="playbackInfo.audioTracks"
        :file-path="playbackInfo.filePath"
        :on-progress="handleProgress"
        :jellyfin-item-id="playbackInfo.jellyfinItemId"
        :jellyfin-media-source-id="playbackInfo.jellyfinMediaSourceId"
        :jellyfin-play-session-id="playbackInfo.jellyfinPlaySessionId"
        :tmdb-id="effectiveTmdbId"
        :media-type="mediaType"
        :season-number="currentSeasonNumber"
        :episode-number="currentEpisodeNumber"
        @close="handleClose"
        @ended="handleEnded"
      />

      <!-- Next Episode Countdown Overlay -->
      <Transition name="fade">
        <NextEpisodeCountdown
          v-if="showNextEpisodeCountdown && nextEpisode"
          :season-number="nextEpisode.seasonNumber"
          :episode-number="nextEpisode.episodeNumber"
          :name="nextEpisode.name"
          :overview="nextEpisode.overview"
          :countdown-seconds="countdownSeconds"
          @cancel="cancelCountdown"
          @play-now="playNextEpisode"
        />
      </Transition>
    </div>

    <!-- Empty state - no stream available -->
    <div v-else-if="!isLoading && !hasError" class="flex flex-col items-center justify-center h-[60vh]">
      <i class="pi pi-exclamation-circle text-5xl text-yellow-500 mb-4"></i>
      <p class="text-white text-lg mb-2">{{ t('player.noStreamAvailable') }}</p>
      <p class="text-gray-400 text-center max-w-md text-sm">
        {{ t('player.noStreamHint') }}
      </p>
    </div>
  </Dialog>
</template>

<style>
/* Playback dialog - full screen player */
.playback-dialog.p-dialog {
  width: 100vw !important;
  max-width: 100vw !important;
  height: 100dvh !important;
  max-height: 100dvh !important;
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
}

.playback-dialog .p-dialog-header {
  display: none !important;
}

.playback-dialog .p-dialog-content {
  background-color: black !important;
  padding: 0 !important;
  border: none !important;
  height: 100dvh !important;
  overflow: hidden !important;
}

/* Desktop: Allow some margin */
@media (min-width: 1024px) {
  .playback-dialog.p-dialog {
    width: 95vw !important;
    max-width: 1600px !important;
    height: 90vh !important;
    max-height: 900px !important;
    margin: auto !important;
    border-radius: 0.75rem !important;
  }

  .playback-dialog .p-dialog-content {
    height: 100% !important;
    border-radius: 0.75rem !important;
  }
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
