import axios from 'axios'
import { setupAuthInterceptor } from '@/composables/useAuthInterceptor'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${API_BASE}/api/media`,
  timeout: 30000
})

// Setup auth interceptor
setupAuthInterceptor(api)

export interface MediaInfo {
  width: number
  height: number
  videoCodec: string
  audioCodec: string
  container: string
}

export interface SubtitleTrack {
  id: number
  streamIndex: number
  language: string
  languageCode: string
  displayTitle: string
  format: string
  url?: string
}

export interface AudioTrack {
  id: number
  streamIndex: number
  language: string
  languageCode: string
  displayTitle: string
  codec: string
  channels: number
  selected: boolean
}

export interface PlaybackInfo {
  found: boolean
  title?: string
  type?: 'movie' | 'episode'
  filePath?: string
  fileSize?: number
  duration?: number
  mediaInfo?: MediaInfo
  streamUrl?: string
  subtitles?: SubtitleTrack[]
  audioTracks?: AudioTrack[]
  // Jellyfin fields
  jellyfinItemId?: string
  jellyfinMediaSourceId?: string
  jellyfinPlaySessionId?: string
}

export interface MediaStatus {
  enabled: boolean
  connected: boolean
  jellyfin?: {
    enabled: boolean
    connected: boolean
  }
}

export const mediaService = {
  /**
   * Check if media service is available
   */
  async getStatus(): Promise<MediaStatus> {
    try {
      const response = await api.get('/status')
      return response.data
    } catch (error) {
      console.error('Error checking media status:', error)
      return { enabled: false, connected: false }
    }
  },

  /**
   * Get playback info for a movie by TMDB ID
   * Returns Jellyfin streaming URLs
   */
  async getMoviePlayback(tmdbId: number): Promise<PlaybackInfo | null> {
    try {
      const response = await api.get(`/movie/${tmdbId}`)

      if (!response.data.found) {
        return null
      }

      // Jellyfin URLs are already absolute - no transformation needed
      return response.data
    } catch (error) {
      console.error('Error fetching movie playback:', error)
      return null
    }
  },

  /**
   * Get playback info for a TV episode
   * Returns Jellyfin streaming URLs
   */
  async getEpisodePlayback(
    showTmdbId: number,
    season: number,
    episode: number
  ): Promise<PlaybackInfo | null> {
    try {
      const response = await api.get(`/episode/${showTmdbId}/${season}/${episode}`)

      if (!response.data.found) {
        return null
      }

      // Jellyfin URLs are already absolute - no transformation needed
      return response.data
    } catch (error) {
      console.error('Error fetching episode playback:', error)
      return null
    }
  },

  /**
   * Get Jellyfin stream URL with different audio track
   */
  async getJellyfinAudioTrackUrl(
    itemId: string,
    audioIndex: number,
    mediaSourceId: string,
    playSessionId: string
  ): Promise<string | null> {
    try {
      const response = await api.get(`/jellyfin/audio/${itemId}/${audioIndex}`, {
        params: { mediaSourceId, playSessionId }
      })
      return response.data.hlsUrl
    } catch (error) {
      console.error('Error getting Jellyfin audio track URL:', error)
      return null
    }
  },

  /**
   * Report playback progress to Jellyfin
   */
  async reportJellyfinProgress(itemId: string, positionMs: number, isPaused: boolean): Promise<void> {
    try {
      await api.post('/jellyfin/progress', { itemId, positionMs, isPaused })
    } catch (error) {
      // Ignore progress reporting errors
    }
  },

  /**
   * Report playback stopped to Jellyfin
   */
  async reportJellyfinStopped(itemId: string, positionMs: number): Promise<void> {
    try {
      await api.post('/jellyfin/stopped', { itemId, positionMs })
    } catch (error) {
      // Ignore stop reporting errors
    }
  },

  /**
   * Trigger Jellyfin library refresh
   */
  async refreshJellyfinLibrary(): Promise<void> {
    try {
      await api.post('/jellyfin/refresh')
    } catch (error) {
      console.error('Error refreshing Jellyfin library:', error)
    }
  }
}
