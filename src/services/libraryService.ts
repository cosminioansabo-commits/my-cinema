import axios from 'axios'
import { setupAuthInterceptor } from '@/composables/useAuthInterceptor'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || ''

const api = axios.create({
  baseURL: `${API_BASE}/api/library`,
  timeout: 30000
})

// Setup auth interceptor
setupAuthInterceptor(api)

export interface ServiceStatus {
  radarr: { enabled: boolean; connected: boolean }
  sonarr: { enabled: boolean; connected: boolean }
  qbittorrent: { connected: boolean }
}

export interface RadarrMovie {
  id: number
  title: string
  year: number
  tmdbId: number
  imdbId?: string
  hasFile: boolean
  monitored: boolean
  path: string
  sizeOnDisk: number
  status: string
  overview: string
  added: string
  images: { coverType: string; url: string; remoteUrl?: string }[]
  ratings?: { tmdb?: { value: number } }
}

export interface SonarrSeries {
  id: number
  title: string
  year: number
  tvdbId: number
  imdbId?: string
  status: string
  monitored: boolean
  path: string
  overview: string
  added: string
  seasonCount?: number
  images: { coverType: string; url: string; remoteUrl?: string }[]
  ratings?: { value: number }
  statistics?: {
    seasonCount: number
    episodeFileCount: number
    episodeCount: number
    totalEpisodeCount: number
    sizeOnDisk: number
    percentOfEpisodes: number
  }
}

export interface SonarrEpisode {
  id: number
  seriesId: number
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate?: string
  airDateUtc?: string
  overview?: string
  hasFile: boolean
  monitored: boolean
}

export interface SonarrSeasonStats {
  seasonNumber: number
  monitored: boolean
  statistics?: {
    episodeFileCount: number
    episodeCount: number
    totalEpisodeCount: number
    sizeOnDisk: number
    percentOfEpisodes: number
  }
}

export interface SonarrSeriesDetails extends SonarrSeries {
  seasons: SonarrSeasonStats[]
}

export interface CalendarEpisode extends SonarrEpisode {
  series: SonarrSeries | null
}

// Profile library API (uses profile-scoped endpoints)
const profileApi = axios.create({
  baseURL: `${API_BASE}/api/profiles`,
  timeout: 30000
})

setupAuthInterceptor(profileApi)

export interface ProfileLibraryEntry {
  id: number
  profileId: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  year?: number
  posterPath?: string
  radarrId?: number
  sonarrId?: number
  tvdbId?: number
  addedAt: string
}

export const profileLibraryService = {
  async getLibrary(profileId: string): Promise<ProfileLibraryEntry[]> {
    const response = await profileApi.get(`/${profileId}/library`)
    return response.data.library
  },

  async addToLibrary(profileId: string, mediaType: string, tmdbId: number, title: string, year?: number, posterPath?: string, tvdbId?: number): Promise<ProfileLibraryEntry> {
    const response = await profileApi.post(`/${profileId}/library`, {
      mediaType, tmdbId, title, year, posterPath, tvdbId
    })
    return response.data
  },

  async removeFromLibrary(profileId: string, mediaType: string, tmdbId: number): Promise<{ removed: boolean; filesDeleted: boolean }> {
    const response = await profileApi.delete(`/${profileId}/library/${mediaType}/${tmdbId}`)
    return response.data
  },

  async checkInLibrary(profileId: string, mediaType: string, tmdbId: number): Promise<boolean> {
    const response = await profileApi.get(`/${profileId}/library/check/${mediaType}/${tmdbId}`)
    return response.data.inLibrary
  },

  async checkAvailability(mediaType: string, tmdbId: number): Promise<{ available: boolean; hasFile: boolean }> {
    const response = await profileApi.get(`/library/available/${mediaType}/${tmdbId}`)
    return response.data
  },

  async updatePosterPath(profileId: string, mediaType: string, tmdbId: number, posterPath: string): Promise<void> {
    await profileApi.patch(`/${profileId}/library/${mediaType}/${tmdbId}/poster`, { posterPath })
  }
}

export const libraryService = {
  // Service status
  async getStatus(): Promise<ServiceStatus> {
    const response = await api.get('/status')
    return response.data
  },

  // ============ MOVIES (Radarr) ============

  async getMovies(): Promise<RadarrMovie[]> {
    const response = await api.get('/movies')
    return response.data.movies
  },

  async checkMovieInLibrary(tmdbId: number): Promise<{ inLibrary: boolean; enabled: boolean; movie?: RadarrMovie }> {
    const response = await api.get(`/movies/check/${tmdbId}`)
    return response.data
  },

  async addMovie(tmdbId: number, title: string, year?: number, searchForMovie: boolean = false): Promise<RadarrMovie | null> {
    try {
      const response = await api.post('/movies', {
        tmdbId,
        title,
        year,
        searchForMovie
      })
      return response.data.movie
    } catch (error) {
      console.error('Error adding movie to library:', error)
      return null
    }
  },

  async deleteMovie(id: number, deleteFiles: boolean = false): Promise<boolean> {
    try {
      const response = await api.delete(`/movies/${id}`, {
        params: { deleteFiles }
      })
      return response.data.success
    } catch (error) {
      console.error('Error deleting movie from library:', error)
      return false
    }
  },

  async getMovieCalendar(startDate?: Date, endDate?: Date): Promise<RadarrMovie[]> {
    const params: Record<string, string> = {}
    if (startDate) params.start = startDate.toISOString()
    if (endDate) params.end = endDate.toISOString()

    const response = await api.get('/movies/calendar', { params })
    return response.data.movies
  },

  // ============ TV SHOWS (Sonarr) ============

  async getSeries(): Promise<SonarrSeries[]> {
    const response = await api.get('/series')
    return response.data.series
  },

  async checkSeriesInLibrary(tvdbId: number): Promise<{ inLibrary: boolean; enabled: boolean; series?: SonarrSeries }> {
    const response = await api.get(`/series/check/${tvdbId}`)
    return response.data
  },

  async lookupSeriesByTmdbId(tmdbId: number): Promise<SonarrSeries | null> {
    const response = await api.get(`/series/lookup/tmdb/${tmdbId}`)
    return response.data.series
  },

  async addSeries(tvdbId: number, title: string, searchForMissingEpisodes: boolean = false): Promise<SonarrSeries | null> {
    try {
      const response = await api.post('/series', {
        tvdbId,
        title,
        searchForMissingEpisodes
      })
      return response.data.series
    } catch (error) {
      console.error('Error adding series to library:', error)
      return null
    }
  },

  async deleteSeries(id: number, deleteFiles: boolean = false): Promise<boolean> {
    try {
      const response = await api.delete(`/series/${id}`, {
        params: { deleteFiles }
      })
      return response.data.success
    } catch (error) {
      console.error('Error deleting series from library:', error)
      return false
    }
  },

  async getUpcomingEpisodes(days: number = 7): Promise<CalendarEpisode[]> {
    const response = await api.get('/series/calendar', {
      params: { days }
    })
    return response.data.episodes
  },

  async getSeriesEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    try {
      const response = await api.get(`/series/${seriesId}/episodes`)
      return response.data.episodes
    } catch (error) {
      console.error('Error fetching series episodes:', error)
      return []
    }
  },

  async getSeriesDetails(seriesId: number): Promise<SonarrSeriesDetails | null> {
    try {
      const response = await api.get(`/series/${seriesId}`)
      return response.data.series
    } catch (error) {
      console.error('Error fetching series details:', error)
      return null
    }
  }
}
