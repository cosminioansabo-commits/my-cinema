import axios, { AxiosInstance } from 'axios'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface SonarrSeries {
  id: number
  title: string
  sortTitle: string
  status: string
  ended: boolean
  overview: string
  network?: string
  airTime?: string
  images: { coverType: string; url: string }[]
  seasons: SonarrSeason[]
  year: number
  path: string
  qualityProfileId: number
  seasonFolder: boolean
  monitored: boolean
  useSceneNumbering: boolean
  runtime: number
  tvdbId: number
  tmdbId?: number
  tvRageId?: number
  tvMazeId?: number
  firstAired?: string
  seriesType: string
  cleanTitle: string
  imdbId?: string
  titleSlug: string
  genres: string[]
  tags: number[]
  added: string
  ratings: { votes: number; value: number }
  statistics?: {
    seasonCount: number
    episodeFileCount: number
    episodeCount: number
    totalEpisodeCount: number
    sizeOnDisk: number
    percentOfEpisodes: number
  }
}

interface SonarrSeason {
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

interface SonarrEpisode {
  id: number
  seriesId: number
  tvdbId: number
  episodeFileId: number
  seasonNumber: number
  episodeNumber: number
  title: string
  airDate?: string
  airDateUtc?: string
  overview?: string
  hasFile: boolean
  monitored: boolean
  absoluteEpisodeNumber?: number
  sceneEpisodeNumber?: number
  sceneSeasonNumber?: number
  unverifiedSceneNumbering: boolean
}

interface SonarrRootFolder {
  id: number
  path: string
  accessible: boolean
  freeSpace: number
}

interface SonarrQualityProfile {
  id: number
  name: string
}

interface SonarrAddSeriesOptions {
  tvdbId: number
  title: string
  qualityProfileId?: number
  rootFolderPath?: string
  monitored?: boolean
  seasonFolder?: boolean
  searchForMissingEpisodes?: boolean
  searchForCutoffUnmetEpisodes?: boolean
}

class SonarrService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.sonarr.url,
      timeout: 30000,
      headers: {
        'X-Api-Key': config.sonarr.apiKey
      }
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v3/system/status')
      logger.debug(`Connected to version ${response.data.version}`, 'Sonarr')
      return true
    } catch (error) {
      console.error('Sonarr: Connection test failed:', error)
      return false
    }
  }

  async getRootFolders(): Promise<SonarrRootFolder[]> {
    try {
      const response = await this.client.get('/api/v3/rootfolder')
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting root folders:', error)
      return []
    }
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    try {
      const response = await this.client.get('/api/v3/qualityprofile')
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting quality profiles:', error)
      return []
    }
  }

  async getSeries(): Promise<SonarrSeries[]> {
    try {
      const response = await this.client.get('/api/v3/series')
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting series:', error)
      return []
    }
  }

  async getSeriesById(id: number): Promise<SonarrSeries | null> {
    try {
      const response = await this.client.get(`/api/v3/series/${id}`)
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting series:', error)
      return null
    }
  }

  async getSeriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null> {
    try {
      const response = await this.client.get('/api/v3/series', {
        params: { tvdbId }
      })
      const series = response.data as SonarrSeries[]
      return series.length > 0 ? series[0] : null
    } catch (error) {
      console.error('Sonarr: Error getting series by TVDB ID:', error)
      return null
    }
  }

  async lookupSeries(tvdbId: number): Promise<SonarrSeries | null> {
    try {
      const response = await this.client.get('/api/v3/series/lookup', {
        params: { term: `tvdb:${tvdbId}` }
      })
      const results = response.data as SonarrSeries[]
      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error('Sonarr: Error looking up series:', error)
      return null
    }
  }

  async lookupSeriesByTmdbId(tmdbId: number): Promise<SonarrSeries | null> {
    try {
      // Sonarr uses TVDB, but we can search by term which might find it
      const response = await this.client.get('/api/v3/series/lookup', {
        params: { term: `tmdb:${tmdbId}` }
      })
      const results = response.data as SonarrSeries[]
      return results.length > 0 ? results[0] : null
    } catch (error) {
      console.error('Sonarr: Error looking up series by TMDB ID:', error)
      return null
    }
  }

  async addSeries(options: SonarrAddSeriesOptions): Promise<SonarrSeries | null> {
    try {
      // First lookup the series to get full details
      const lookupResult = await this.lookupSeries(options.tvdbId)
      if (!lookupResult) {
        console.error('Sonarr: Series not found in lookup')
        return null
      }

      // Get default root folder and quality profile if not specified
      let rootFolderPath = options.rootFolderPath
      let qualityProfileId = options.qualityProfileId

      if (!rootFolderPath) {
        const rootFolders = await this.getRootFolders()
        if (rootFolders.length > 0) {
          rootFolderPath = rootFolders[0].path
        } else {
          console.error('Sonarr: No root folders configured')
          return null
        }
      }

      if (!qualityProfileId) {
        const profiles = await this.getQualityProfiles()
        if (profiles.length > 0) {
          qualityProfileId = profiles[0].id
        } else {
          console.error('Sonarr: No quality profiles configured')
          return null
        }
      }

      const seriesData = {
        ...lookupResult,
        rootFolderPath,
        qualityProfileId,
        monitored: options.monitored ?? true,
        seasonFolder: options.seasonFolder ?? true,
        addOptions: {
          searchForMissingEpisodes: options.searchForMissingEpisodes ?? false,
          searchForCutoffUnmetEpisodes: options.searchForCutoffUnmetEpisodes ?? false
        }
      }

      const response = await this.client.post('/api/v3/series', seriesData)
      logger.debug(`Added series "${options.title}" to library`, 'Sonarr')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.[0]?.errorMessage?.includes('already been added')) {
        logger.debug(`Series "${options.title}" already in library`, 'Sonarr')
        return await this.getSeriesByTvdbId(options.tvdbId)
      }
      console.error('Sonarr: Error adding series:', error.response?.data || error)
      return null
    }
  }

  async deleteSeries(id: number, deleteFiles: boolean = false): Promise<boolean> {
    try {
      await this.client.delete(`/api/v3/series/${id}`, {
        params: { deleteFiles }
      })
      return true
    } catch (error) {
      console.error('Sonarr: Error deleting series:', error)
      return false
    }
  }

  async getEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    try {
      const response = await this.client.get('/api/v3/episode', {
        params: { seriesId }
      })
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting episodes:', error)
      return []
    }
  }

  async getCalendar(startDate?: Date, endDate?: Date): Promise<SonarrEpisode[]> {
    try {
      const params: Record<string, string> = {}
      if (startDate) {
        params.start = startDate.toISOString()
      }
      if (endDate) {
        params.end = endDate.toISOString()
      }

      const response = await this.client.get('/api/v3/calendar', { params })
      return response.data
    } catch (error) {
      console.error('Sonarr: Error getting calendar:', error)
      return []
    }
  }

  async getUpcoming(days: number = 7): Promise<SonarrEpisode[]> {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)
    return this.getCalendar(startDate, endDate)
  }

  async getDownloadQueue(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/v3/queue')
      return response.data.records || []
    } catch (error) {
      console.error('Sonarr: Error getting download queue:', error)
      return []
    }
  }

  async triggerRescan(seriesId: number): Promise<boolean> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'RescanSeries',
        seriesId
      })
      return true
    } catch (error) {
      console.error('Sonarr: Error triggering rescan:', error)
      return false
    }
  }

  async triggerSearch(seriesId: number): Promise<boolean> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'SeriesSearch',
        seriesId
      })
      return true
    } catch (error) {
      console.error('Sonarr: Error triggering search:', error)
      return false
    }
  }

  async triggerEpisodeSearch(episodeIds: number[]): Promise<boolean> {
    try {
      await this.client.post('/api/v3/command', {
        name: 'EpisodeSearch',
        episodeIds
      })
      return true
    } catch (error) {
      console.error('Sonarr: Error triggering episode search:', error)
      return false
    }
  }

  isEnabled(): boolean {
    return config.sonarr.enabled
  }
}

export const sonarrService = new SonarrService()
