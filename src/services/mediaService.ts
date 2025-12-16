import axios from 'axios'
import { setupAuthInterceptor } from '@/composables/useAuthInterceptor'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || 'http://localhost:3001'
const TOKEN_KEY = 'my-cinema-auth-token'

const api = axios.create({
  baseURL: `${API_BASE}/api/media`,
  timeout: 30000
})

// Setup auth interceptor
setupAuthInterceptor(api)

// Helper to get auth token for stream URLs
const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

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

// Playback strategy determines optimal streaming method
export type PlaybackStrategy = 'direct' | 'remux' | 'transcode'

export interface PlaybackInfo {
  found: boolean
  title?: string
  type?: 'movie' | 'episode'
  filePath?: string
  fileSize?: number
  duration?: number
  mediaInfo?: MediaInfo
  needsTranscode?: boolean // Legacy: kept for compatibility
  playbackStrategy?: PlaybackStrategy // New: more granular
  streamUrl?: string
  directStreamUrl?: string // Fallback URL for direct streaming
  hlsSupported?: boolean // True if HLS streaming is available
  subtitles?: SubtitleTrack[]
  audioTracks?: AudioTrack[]
}

// HLS Session management
export interface HlsSession {
  sessionId: string
  playlistUrl: string
}

export interface MediaStatus {
  enabled: boolean
  connected: boolean
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
   * Start an HLS streaming session for better seeking and quality control
   */
  async startHlsSession(
    filePath: string,
    options: {
      audioTrack?: number
      quality?: 'original' | '1080p' | '720p' | '480p'
      startTime?: number
    } = {}
  ): Promise<HlsSession | null> {
    try {
      const token = getAuthToken()
      const response = await api.post('/hls/start', {
        filePath,
        audioTrack: options.audioTrack ?? 0,
        quality: options.quality ?? 'original',
        startTime: options.startTime ?? 0
      })

      const session = response.data as HlsSession

      // Add auth token to playlist URL
      if (session.playlistUrl) {
        const authParam = token ? `?token=${encodeURIComponent(token)}` : ''
        session.playlistUrl = `${API_BASE}${session.playlistUrl}${authParam}`
      }

      return session
    } catch (error) {
      console.error('Error starting HLS session:', error)
      return null
    }
  },

  /**
   * Seek within an active HLS session
   */
  async seekHlsSession(sessionId: string, position: number): Promise<boolean> {
    try {
      const token = getAuthToken()
      await api.post(`/hls/${sessionId}/seek`, { position }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      return true
    } catch (error) {
      console.error('Error seeking HLS session:', error)
      return false
    }
  },

  /**
   * Stop an HLS session and cleanup resources
   */
  async stopHlsSession(sessionId: string): Promise<void> {
    try {
      const token = getAuthToken()
      await api.delete(`/hls/${sessionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
    } catch (error) {
      console.error('Error stopping HLS session:', error)
    }
  },

  /**
   * Get playback info for a movie by TMDB ID
   */
  async getMoviePlayback(tmdbId: number): Promise<PlaybackInfo | null> {
    try {
      const response = await api.get(`/movie/${tmdbId}`)

      if (!response.data.found) {
        return null
      }

      // Prepend API base URL to relative URLs and add auth token
      const token = getAuthToken()
      const authParam = token ? `?token=${encodeURIComponent(token)}` : ''

      if (response.data.streamUrl && response.data.streamUrl.startsWith('/')) {
        response.data.streamUrl = `${API_BASE}${response.data.streamUrl}${authParam}`
      }

      // Also update direct stream URL if present
      if (response.data.directStreamUrl && response.data.directStreamUrl.startsWith('/')) {
        response.data.directStreamUrl = `${API_BASE}${response.data.directStreamUrl}${authParam}`
      }

      // Also update subtitle URLs
      if (response.data.subtitles) {
        response.data.subtitles = response.data.subtitles.map((sub: SubtitleTrack) => ({
          ...sub,
          url: `/api/media/subtitle/${encodeURIComponent(`${sub.streamIndex}:${response.data.filePath}`)}`,
        })).map((sub: SubtitleTrack) => ({
          ...sub,
          url: sub.url?.startsWith('/') ? `${API_BASE}${sub.url}${authParam}` : sub.url
        }))
      }

      return response.data
    } catch (error) {
      console.error('Error fetching movie playback:', error)
      return null
    }
  },

  /**
   * Get playback info for a TV episode
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

      // Prepend API base URL to relative URLs and add auth token
      const token = getAuthToken()
      const authParam = token ? `?token=${encodeURIComponent(token)}` : ''

      if (response.data.streamUrl && response.data.streamUrl.startsWith('/')) {
        response.data.streamUrl = `${API_BASE}${response.data.streamUrl}${authParam}`
      }

      // Also update direct stream URL if present
      if (response.data.directStreamUrl && response.data.directStreamUrl.startsWith('/')) {
        response.data.directStreamUrl = `${API_BASE}${response.data.directStreamUrl}${authParam}`
      }

      // Also update subtitle URLs
      if (response.data.subtitles) {
        response.data.subtitles = response.data.subtitles.map((sub: SubtitleTrack) => ({
          ...sub,
          url: `/api/media/subtitle/${encodeURIComponent(`${sub.streamIndex}:${response.data.filePath}`)}`,
        })).map((sub: SubtitleTrack) => ({
          ...sub,
          url: sub.url?.startsWith('/') ? `${API_BASE}${sub.url}${authParam}` : sub.url
        }))
      }

      return response.data
    } catch (error) {
      console.error('Error fetching episode playback:', error)
      return null
    }
  }
}
