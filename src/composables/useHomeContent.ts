import { ref, computed } from 'vue'
import type { Media } from '@/types'
import {
  getFeaturedContent,
  getTrending,
  getPopularMovies,
  getPopularTV,
  getTopRatedMovies,
  getTopRatedTV,
  getNowPlayingMovies,
  getUpcomingMovies,
  getOnTheAirTV,
  getCriticallyAcclaimed,
  getHiddenGems,
  getNewReleases,
  getAnime,
  getActionAdventure,
  getSciFiFantasy,
  getCrimeThriller,
  getComedy,
  getHorror,
  getDocumentaries,
  getKoreanDramas,
  getBackdropUrl,
  findByExternalId,
  getMediaDetails,
} from '@/services/tmdbService'
import { libraryService, type RadarrMovie, type SonarrSeries } from '@/services/libraryService'
import { progressService } from '@/services/progressService'
import type { ContinueWatchingItem } from '@/components/media/ContinueWatchingCarousel.vue'

export function useHomeContent() {
  // Hero
  const featuredItem = ref<Media | null>(null)
  const isLoadingHero = ref(true)

  // Primary content
  const trendingAll = ref<Media[]>([])
  const popularMovies = ref<Media[]>([])
  const popularTV = ref<Media[]>([])
  const topRatedMovies = ref<Media[]>([])
  const topRatedTV = ref<Media[]>([])
  const nowPlaying = ref<Media[]>([])
  const isLoadingContent = ref(true)

  // Secondary content (Netflix-style categories)
  const upcomingMovies = ref<Media[]>([])
  const onTheAirTV = ref<Media[]>([])
  const criticallyAcclaimedMovies = ref<Media[]>([])
  const hiddenGemsMovies = ref<Media[]>([])
  const newReleasesMovies = ref<Media[]>([])
  const animeTV = ref<Media[]>([])
  const actionMovies = ref<Media[]>([])
  const sciFiMovies = ref<Media[]>([])
  const crimeTV = ref<Media[]>([])
  const comedyMovies = ref<Media[]>([])
  const horrorMovies = ref<Media[]>([])
  const documentaries = ref<Media[]>([])
  const kDramas = ref<Media[]>([])
  const isLoadingMoreContent = ref(true)

  // Library and continue watching
  const libraryItems = ref<Media[]>([])
  const continueWatchingItems = ref<ContinueWatchingItem[]>([])
  const isLoadingContinueWatching = ref(false)

  // Hero computed properties
  const heroBackdrop = computed(() => {
    if (!featuredItem.value?.backdropPath) return ''
    return getBackdropUrl(featuredItem.value.backdropPath, 'w1280')
  })

  const heroYear = computed(() => {
    if (!featuredItem.value?.releaseDate) return ''
    return new Date(featuredItem.value.releaseDate).getFullYear()
  })

  const heroRating = computed(() => {
    if (!featuredItem.value) return '0'
    return Math.round(featuredItem.value.voteAverage * 10)
  })

  // Load hero content
  const loadHeroContent = async () => {
    try {
      featuredItem.value = await getFeaturedContent()
    } catch (error) {
      console.error('Failed to load featured content:', error)
    } finally {
      isLoadingHero.value = false
    }
  }

  // Load continue watching items and enrich with TMDB data
  const loadContinueWatching = async () => {
    try {
      isLoadingContinueWatching.value = true
      const items = await progressService.getContinueWatching(10)

      const enrichedItems: ContinueWatchingItem[] = await Promise.all(
        items.map(async (item) => {
          try {
            if (item.mediaType === 'movie') {
              const movieDetails = await getMediaDetails('movie', item.tmdbId)
              return {
                ...item,
                title: movieDetails?.title || 'Unknown Movie',
                posterPath: movieDetails?.posterPath || null,
              }
            } else {
              const showDetails = await getMediaDetails('tv', item.tmdbId)
              return {
                ...item,
                title: showDetails?.title || 'Unknown Show',
                posterPath: showDetails?.posterPath || null,
                episodeTitle: item.seasonNumber && item.episodeNumber
                  ? `S${item.seasonNumber}:E${item.episodeNumber}`
                  : undefined,
              }
            }
          } catch {
            return {
              ...item,
              title: 'Unknown',
              posterPath: null,
            }
          }
        })
      )

      continueWatchingItems.value = enrichedItems
    } catch (error) {
      console.error('Failed to load continue watching:', error)
      continueWatchingItems.value = []
    } finally {
      isLoadingContinueWatching.value = false
    }
  }

  // Load library items
  const loadLibraryItems = async () => {
    try {
      const [movies, series] = await Promise.all([
        libraryService.getMovies(),
        libraryService.getSeries(),
      ])

      const movieMedia = await Promise.all(
        movies.slice(0, 10).map(async (movie: RadarrMovie) => {
          const tmdb = await findByExternalId(movie.tmdbId, 'imdb_id').catch(() => null)
          return {
            id: movie.tmdbId,
            title: movie.title,
            posterPath: tmdb?.posterPath || movie.images?.find((i: { coverType: string }) => i.coverType === 'poster')?.remoteUrl || null,
            releaseDate: movie.year ? `${movie.year}-01-01` : '',
            voteAverage: movie.ratings?.tmdb?.value || 0,
            mediaType: 'movie' as const,
            overview: movie.overview || '',
            backdropPath: null,
            voteCount: 0,
            genreIds: [],
            popularity: 0,
          }
        })
      )

      const seriesMedia = await Promise.all(
        series.slice(0, 10).map(async (s: SonarrSeries) => {
          const tmdb = await findByExternalId(s.tvdbId, 'tvdb_id').catch(() => null)
          return {
            id: tmdb?.id || s.tvdbId,
            title: s.title,
            posterPath: tmdb?.posterPath || s.images?.find((i: { coverType: string }) => i.coverType === 'poster')?.remoteUrl || null,
            releaseDate: s.year ? `${s.year}-01-01` : '',
            voteAverage: s.ratings?.value || 0,
            mediaType: 'tv' as const,
            overview: s.overview || '',
            backdropPath: null,
            voteCount: 0,
            genreIds: [],
            popularity: 0,
          }
        })
      )

      libraryItems.value = [...movieMedia, ...seriesMedia].slice(0, 20)
    } catch (error) {
      console.error('Failed to load library items:', error)
    }
  }

  // Load primary content
  const loadPrimaryContent = async () => {
    try {
      const [trending, movies, tv, topMovies, topTV, playing] = await Promise.all([
        getTrending('all', 'week'),
        getPopularMovies(),
        getPopularTV(),
        getTopRatedMovies(),
        getTopRatedTV(),
        getNowPlayingMovies(),
      ])

      trendingAll.value = trending
      popularMovies.value = movies
      popularTV.value = tv
      topRatedMovies.value = topMovies
      topRatedTV.value = topTV
      nowPlaying.value = playing
    } catch (error) {
      console.error('Failed to load content:', error)
    } finally {
      isLoadingContent.value = false
    }
  }

  // Load secondary content
  const loadSecondaryContent = async () => {
    try {
      const [
        upcoming,
        onAir,
        acclaimed,
        hidden,
        newReleases,
        anime,
        action,
        sciFi,
        crime,
        comedy,
        horror,
        docs,
        korean,
      ] = await Promise.all([
        getUpcomingMovies(),
        getOnTheAirTV(),
        getCriticallyAcclaimed('movie'),
        getHiddenGems('movie'),
        getNewReleases('movie'),
        getAnime('tv'),
        getActionAdventure('movie'),
        getSciFiFantasy('movie'),
        getCrimeThriller('tv'),
        getComedy('movie'),
        getHorror('movie'),
        getDocumentaries('movie'),
        getKoreanDramas(),
      ])

      upcomingMovies.value = upcoming
      onTheAirTV.value = onAir
      criticallyAcclaimedMovies.value = acclaimed
      hiddenGemsMovies.value = hidden
      newReleasesMovies.value = newReleases
      animeTV.value = anime
      actionMovies.value = action
      sciFiMovies.value = sciFi
      crimeTV.value = crime
      comedyMovies.value = comedy
      horrorMovies.value = horror
      documentaries.value = docs
      kDramas.value = korean
    } catch (error) {
      console.error('Failed to load additional content:', error)
    } finally {
      isLoadingMoreContent.value = false
    }
  }

  // Load all content
  const loadAllContent = async (isAuthenticated: boolean) => {
    // Load hero first
    await loadHeroContent()

    // Load library content if authenticated
    if (isAuthenticated) {
      loadContinueWatching()
      loadLibraryItems()
    }

    // Load content in parallel
    await loadPrimaryContent()
    await loadSecondaryContent()
  }

  return {
    // Hero
    featuredItem,
    isLoadingHero,
    heroBackdrop,
    heroYear,
    heroRating,

    // Primary content
    trendingAll,
    popularMovies,
    popularTV,
    topRatedMovies,
    topRatedTV,
    nowPlaying,
    isLoadingContent,

    // Secondary content
    upcomingMovies,
    onTheAirTV,
    criticallyAcclaimedMovies,
    hiddenGemsMovies,
    newReleasesMovies,
    animeTV,
    actionMovies,
    sciFiMovies,
    crimeTV,
    comedyMovies,
    horrorMovies,
    documentaries,
    kDramas,
    isLoadingMoreContent,

    // Library
    libraryItems,
    continueWatchingItems,
    isLoadingContinueWatching,

    // Methods
    loadHeroContent,
    loadContinueWatching,
    loadLibraryItems,
    loadPrimaryContent,
    loadSecondaryContent,
    loadAllContent,
  }
}
