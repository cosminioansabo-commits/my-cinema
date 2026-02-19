import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FilterOptions, MediaType, SortOption, Genre } from '@/types'
import { STREAMING_PLATFORMS } from '@/types'
import { getAllGenres } from '@/services/tmdbService'

const currentYear = new Date().getFullYear()

// Static sort options - defined outside store to avoid recreation
const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'popularity.asc', label: 'Least Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'vote_average.asc', label: 'Lowest Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'release_date.asc', label: 'Oldest First' },
  { value: 'title.asc', label: 'Title A-Z' },
  { value: 'title.desc', label: 'Title Z-A' },
]

const DEFAULT_FILTERS: FilterOptions = {
  mediaType: 'all',
  genres: [],
  platforms: [],
  yearRange: [1900, currentYear],
  ratingRange: [0, 10],
  sortBy: 'popularity.desc',
  animeOnly: false,
}

export const useFiltersStore = defineStore('filters', () => {
  // State
  const filters = ref<FilterOptions>({ ...DEFAULT_FILTERS })
  const movieGenres = ref<Genre[]>([])
  const tvGenres = ref<Genre[]>([])
  const genresLoaded = ref(false)

  // Genre lookup Maps for O(1) access
  const movieGenreMap = ref<Map<number, Genre>>(new Map())
  const tvGenreMap = ref<Map<number, Genre>>(new Map())

  // Getters
  const hasActiveFilters = computed(() => {
    return (
      filters.value.mediaType !== 'all' ||
      filters.value.genres.length > 0 ||
      filters.value.platforms.length > 0 ||
      filters.value.yearRange[0] !== 1900 ||
      filters.value.yearRange[1] !== currentYear ||
      filters.value.ratingRange[0] !== 0 ||
      filters.value.ratingRange[1] !== 10 ||
      filters.value.sortBy !== 'popularity.desc' ||
      filters.value.animeOnly
    )
  })

  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.value.mediaType !== 'all') count++
    if (filters.value.genres.length > 0) count++
    if (filters.value.platforms.length > 0) count++
    if (filters.value.yearRange[0] !== 1900 || filters.value.yearRange[1] !== currentYear) count++
    if (filters.value.ratingRange[0] !== 0 || filters.value.ratingRange[1] !== 10) count++
    if (filters.value.sortBy !== 'popularity.desc') count++
    if (filters.value.animeOnly) count++
    return count
  })

  const availableGenres = computed(() => {
    if (filters.value.mediaType === 'movie') return movieGenres.value
    if (filters.value.mediaType === 'tv') return tvGenres.value
    // Combine and dedupe for 'all' using Map for O(1) lookup
    const combined = new Map<number, Genre>()
    for (const genre of movieGenres.value) {
      combined.set(genre.id, genre)
    }
    for (const genre of tvGenres.value) {
      if (!combined.has(genre.id)) {
        combined.set(genre.id, genre)
      }
    }
    return Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name))
  })

  // Use static arrays directly instead of computed for constants
  const streamingPlatforms = STREAMING_PLATFORMS
  const sortOptions = SORT_OPTIONS

  // Actions
  async function loadGenres() {
    if (genresLoaded.value) return

    try {
      const genres = await getAllGenres()
      movieGenres.value = genres.movie
      tvGenres.value = genres.tv

      // Populate lookup Maps for O(1) access
      movieGenreMap.value = new Map(genres.movie.map(g => [g.id, g]))
      tvGenreMap.value = new Map(genres.tv.map(g => [g.id, g]))

      genresLoaded.value = true
    } catch (error) {
      console.error('Failed to load genres:', error)
    }
  }

  // O(1) genre lookup by ID
  function getGenreById(id: number, mediaType?: 'movie' | 'tv'): Genre | undefined {
    if (mediaType === 'movie') return movieGenreMap.value.get(id)
    if (mediaType === 'tv') return tvGenreMap.value.get(id)
    return movieGenreMap.value.get(id) || tvGenreMap.value.get(id)
  }

  function setMediaType(mediaType: MediaType | 'all') {
    filters.value.mediaType = mediaType
    // Clear genre selection if switching media type
    filters.value.genres = []
  }

  function toggleGenre(genreId: number) {
    const index = filters.value.genres.indexOf(genreId)
    if (index === -1) {
      filters.value.genres.push(genreId)
    } else {
      filters.value.genres.splice(index, 1)
    }
  }

  function setGenres(genreIds: number[]) {
    filters.value.genres = genreIds
  }

  function togglePlatform(platformId: number) {
    const index = filters.value.platforms.indexOf(platformId)
    if (index === -1) {
      filters.value.platforms.push(platformId)
    } else {
      filters.value.platforms.splice(index, 1)
    }
  }

  function setPlatforms(platformIds: number[]) {
    filters.value.platforms = platformIds
  }

  function setYearRange(range: [number, number]) {
    filters.value.yearRange = range
  }

  function setRatingRange(range: [number, number]) {
    filters.value.ratingRange = range
  }

  function setSortBy(sortBy: SortOption) {
    filters.value.sortBy = sortBy
  }

  function setAnimeOnly(value: boolean) {
    filters.value.animeOnly = value
  }

  function resetFilters() {
    filters.value = { ...DEFAULT_FILTERS }
  }

  function resetFilter(filterName: keyof FilterOptions) {
    switch (filterName) {
      case 'mediaType':
        filters.value.mediaType = 'all'
        break
      case 'genres':
        filters.value.genres = []
        break
      case 'platforms':
        filters.value.platforms = []
        break
      case 'yearRange':
        filters.value.yearRange = [1900, currentYear]
        break
      case 'ratingRange':
        filters.value.ratingRange = [0, 10]
        break
      case 'sortBy':
        filters.value.sortBy = 'popularity.desc'
        break
      case 'animeOnly':
        filters.value.animeOnly = false
        break
    }
  }

  return {
    // State
    filters,
    movieGenres,
    tvGenres,
    genresLoaded,
    // Getters
    hasActiveFilters,
    activeFilterCount,
    availableGenres,
    streamingPlatforms,
    sortOptions,
    // Actions
    loadGenres,
    getGenreById,
    setMediaType,
    toggleGenre,
    setGenres,
    togglePlatform,
    setPlatforms,
    setYearRange,
    setRatingRange,
    setSortBy,
    setAnimeOnly,
    resetFilters,
    resetFilter,
  }
})
