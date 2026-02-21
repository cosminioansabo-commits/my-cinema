import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import type { Media, MediaDetails, MediaType } from '@/types'
import { getTrending, searchMulti, discoverMedia, getMediaDetails, type PersonResult } from '@/services/tmdbService'
import { useFiltersStore } from './filtersStore'

export const useMediaStore = defineStore('media', () => {
  // State
  const trending = ref<Media[]>([])
  const searchResults = ref<Media[]>([])
  const searchPeople = ref<PersonResult[]>([])
  const browseResults = ref<Media[]>([])
  const currentMedia = ref<MediaDetails | null>(null)

  const isLoadingTrending = ref(false)
  const isLoadingSearch = ref(false)
  const isLoadingBrowse = ref(false)
  const isLoadingDetails = ref(false)

  const searchQuery = ref('')
  const currentPage = ref(1)
  const totalPages = ref(0)
  const totalResults = ref(0)

  const error = ref<string | null>(null)

  // AbortController for cancelling stale search requests
  let searchAbortController: AbortController | null = null

  // Actions
  async function fetchTrending(mediaType: MediaType | 'all' = 'all') {
    isLoadingTrending.value = true
    error.value = null

    try {
      trending.value = await getTrending(mediaType)
    } catch (e) {
      error.value = 'Failed to load trending content'
      console.error(e)
    } finally {
      isLoadingTrending.value = false
    }
  }

  async function search(query: string, page = 1) {
    if (!query.trim()) {
      searchResults.value = []
      return
    }

    // Abort any in-flight search request
    if (searchAbortController) {
      searchAbortController.abort()
    }
    searchAbortController = new AbortController()

    searchQuery.value = query
    isLoadingSearch.value = true
    error.value = null

    try {
      const response = await searchMulti(query, page, searchAbortController.signal)
      if (page === 1) {
        searchResults.value = response.results
        searchPeople.value = response.people
      } else {
        searchResults.value = [...searchResults.value, ...response.results]
        // Only show people on first page
      }
      totalPages.value = response.totalPages
      totalResults.value = response.totalResults
      currentPage.value = page
    } catch (e) {
      // Ignore aborted requests
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (axios.isCancel(e)) return
      error.value = 'Search failed'
      console.error(e)
    } finally {
      isLoadingSearch.value = false
    }
  }

  async function loadMoreSearchResults() {
    if (currentPage.value < totalPages.value && !isLoadingSearch.value) {
      await search(searchQuery.value, currentPage.value + 1)
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    searchPeople.value = []
    currentPage.value = 1
    totalPages.value = 0
    totalResults.value = 0
  }

  async function browse(page = 1, append = false) {
    const filtersStore = useFiltersStore()
    isLoadingBrowse.value = true
    error.value = null

    try {
      // If mediaType is 'all', we need to fetch both and combine
      if (filtersStore.filters.mediaType === 'all') {
        const [movieResponse, tvResponse] = await Promise.all([
          discoverMedia('movie', filtersStore.filters, page),
          discoverMedia('tv', filtersStore.filters, page),
        ])

        const combined = [...movieResponse.results, ...tvResponse.results]
          .sort((a, b) => b.popularity - a.popularity)

        if (append) {
          browseResults.value = [...browseResults.value, ...combined]
        } else {
          browseResults.value = combined
        }

        totalPages.value = Math.max(movieResponse.totalPages, tvResponse.totalPages)
        totalResults.value = movieResponse.totalResults + tvResponse.totalResults
      } else {
        const response = await discoverMedia(
          filtersStore.filters.mediaType,
          filtersStore.filters,
          page
        )

        if (append) {
          browseResults.value = [...browseResults.value, ...response.results]
        } else {
          browseResults.value = response.results
        }

        totalPages.value = response.totalPages
        totalResults.value = response.totalResults
      }

      currentPage.value = page
    } catch (e) {
      error.value = 'Failed to load content'
      console.error(e)
    } finally {
      isLoadingBrowse.value = false
    }
  }

  async function loadMoreBrowseResults() {
    if (currentPage.value < totalPages.value && !isLoadingBrowse.value) {
      await browse(currentPage.value + 1, true)
    }
  }

  async function fetchMediaDetails(mediaType: MediaType, id: number) {
    isLoadingDetails.value = true
    error.value = null
    currentMedia.value = null

    try {
      currentMedia.value = await getMediaDetails(mediaType, id)
    } catch (e) {
      error.value = 'Failed to load media details'
      console.error(e)
    } finally {
      isLoadingDetails.value = false
    }
  }

  function clearCurrentMedia() {
    currentMedia.value = null
  }

  function clearBrowseResults() {
    browseResults.value = []
    currentPage.value = 1
    totalPages.value = 0
    totalResults.value = 0
  }

  return {
    // State
    trending,
    searchResults,
    searchPeople,
    browseResults,
    currentMedia,
    isLoadingTrending,
    isLoadingSearch,
    isLoadingBrowse,
    isLoadingDetails,
    searchQuery,
    currentPage,
    totalPages,
    totalResults,
    error,
    // Actions
    fetchTrending,
    search,
    loadMoreSearchResults,
    clearSearch,
    browse,
    loadMoreBrowseResults,
    fetchMediaDetails,
    clearCurrentMedia,
    clearBrowseResults,
  }
})
