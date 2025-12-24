import { ref, onUnmounted } from 'vue'
import { getTVSeasonDetails, getMediaDetails } from '@/services/tmdbService'

export interface NextEpisodeInfo {
  seasonNumber: number
  episodeNumber: number
  name: string
  overview: string
  stillPath: string | null
}

export function useNextEpisode() {
  const nextEpisode = ref<NextEpisodeInfo | null>(null)
  const showNextEpisodeCountdown = ref(false)
  const countdownSeconds = ref(10)
  let countdownInterval: ReturnType<typeof setInterval> | null = null

  const fetchNextEpisode = async (
    showTmdbId: number,
    currentSeasonNumber: number,
    currentEpisodeNumber: number
  ) => {
    try {
      // Get current season details
      const seasonDetails = await getTVSeasonDetails(showTmdbId, currentSeasonNumber)
      if (!seasonDetails?.episodes) {
        nextEpisode.value = null
        return
      }

      // Check if there's a next episode in current season
      const nextEpInSeason = seasonDetails.episodes.find(
        ep => ep.episodeNumber === currentEpisodeNumber + 1
      )

      if (nextEpInSeason) {
        nextEpisode.value = {
          seasonNumber: currentSeasonNumber,
          episodeNumber: nextEpInSeason.episodeNumber,
          name: nextEpInSeason.name,
          overview: nextEpInSeason.overview,
          stillPath: nextEpInSeason.stillPath,
        }
        return
      }

      // Check if there's a next season
      const showDetails = await getMediaDetails('tv', showTmdbId)
      if (!showDetails?.numberOfSeasons || currentSeasonNumber >= showDetails.numberOfSeasons) {
        nextEpisode.value = null
        return
      }

      // Get first episode of next season
      const nextSeasonDetails = await getTVSeasonDetails(showTmdbId, currentSeasonNumber + 1)
      if (!nextSeasonDetails?.episodes || nextSeasonDetails.episodes.length === 0) {
        nextEpisode.value = null
        return
      }

      const firstEpNextSeason = nextSeasonDetails.episodes[0]
      nextEpisode.value = {
        seasonNumber: currentSeasonNumber + 1,
        episodeNumber: firstEpNextSeason.episodeNumber,
        name: firstEpNextSeason.name,
        overview: firstEpNextSeason.overview,
        stillPath: firstEpNextSeason.stillPath,
      }
    } catch (error) {
      console.error('Error fetching next episode:', error)
      nextEpisode.value = null
    }
  }

  const startCountdown = (onCountdownEnd: () => void) => {
    countdownSeconds.value = 10
    showNextEpisodeCountdown.value = true

    countdownInterval = setInterval(() => {
      countdownSeconds.value--
      if (countdownSeconds.value <= 0) {
        onCountdownEnd()
      }
    }, 1000)
  }

  const cancelCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    showNextEpisodeCountdown.value = false
  }

  const reset = () => {
    cancelCountdown()
    nextEpisode.value = null
  }

  onUnmounted(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  })

  return {
    nextEpisode,
    showNextEpisodeCountdown,
    countdownSeconds,
    fetchNextEpisode,
    startCountdown,
    cancelCountdown,
    reset,
  }
}
