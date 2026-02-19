import { radarrService } from './radarrService.js'
import { sonarrService } from './sonarrService.js'
import { jellyfinService } from './jellyfinService.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

export interface SubtitleTrack {
  id: number
  streamIndex: number
  language: string
  languageCode: string
  displayTitle: string
  format: string
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
  title: string
  type: 'movie' | 'episode'
  filePath: string
  fileSize: number
  duration: number // in milliseconds
  mediaInfo: {
    width: number
    height: number
    videoCodec: string
    audioCodec: string
    container: string
  }
  streamUrl: string
  subtitles: SubtitleTrack[]
  audioTracks: AudioTrack[]
  // Jellyfin-specific fields
  jellyfinItemId: string
  jellyfinMediaSourceId: string
  jellyfinPlaySessionId: string
}

class MediaService {
  // Get movie playback info by TMDB ID
  async getMoviePlayback(tmdbId: number): Promise<PlaybackInfo | null> {
    // Get movie from Radarr
    const movie = await radarrService.getMovieByTmdbId(tmdbId)
    if (!movie) {
      logger.debug(`Movie with TMDB ID ${tmdbId} not found in Radarr`, 'MediaService')
      return null
    }

    if (!movie.hasFile || !movie.movieFile?.path) {
      logger.debug(`Movie "${movie.title}" has no file`, 'MediaService')
      return null
    }

    const filePath = movie.movieFile.path
    const fileSize = movie.movieFile.size || 0

    // Check if Jellyfin is enabled
    if (!jellyfinService.isEnabled()) {
      console.error('MediaService: Jellyfin is not configured. Please set JELLYFIN_URL and JELLYFIN_API_KEY')
      return null
    }

    // Find movie in Jellyfin
    const jellyfinItem = await jellyfinService.findMovieByPath(filePath)
    if (!jellyfinItem) {
      logger.debug(`Movie "${movie.title}" not found in Jellyfin library`, 'MediaService')
      return null
    }

    // Get playback info from Jellyfin
    const playbackInfo = await jellyfinService.getPlaybackInfo(jellyfinItem.Id)
    if (!playbackInfo) {
      logger.debug(`Could not get playback info from Jellyfin for "${movie.title}"`, 'MediaService')
      return null
    }

    logger.debug(`${movie.title} (via Jellyfin)`, 'MediaService')
    logger.debug(`  Jellyfin ID: ${playbackInfo.jellyfinItemId}`, 'MediaService')
    logger.debug(`  Stream URL: ${playbackInfo.hlsUrl.substring(0, 80)}...`, 'MediaService')
    logger.debug(`  Audio tracks: ${playbackInfo.audioTracks.length}`, 'MediaService')
    logger.debug(`  Subtitles: ${playbackInfo.subtitles.length}`, 'MediaService')

    return {
      found: true,
      title: movie.title,
      type: 'movie',
      filePath,
      fileSize,
      duration: playbackInfo.duration,
      mediaInfo: playbackInfo.mediaInfo,
      streamUrl: playbackInfo.hlsUrl,
      subtitles: playbackInfo.subtitles,
      audioTracks: playbackInfo.audioTracks,
      jellyfinItemId: playbackInfo.jellyfinItemId,
      jellyfinMediaSourceId: playbackInfo.mediaSourceId,
      jellyfinPlaySessionId: playbackInfo.playSessionId
    }
  }

  // Get episode playback info by TMDB ID, season, and episode
  async getEpisodePlayback(tmdbId: number, season: number, episode: number): Promise<PlaybackInfo | null> {
    // First, we need to find the series in Sonarr
    // Sonarr uses TVDB IDs, so we need to look up via TMDB
    const lookup = await sonarrService.lookupSeriesByTmdbId(tmdbId)
    if (!lookup || !lookup.tvdbId) {
      logger.debug(`Could not lookup series with TMDB ID ${tmdbId}`, 'MediaService')
      return null
    }

    const series = await sonarrService.getSeriesByTvdbId(lookup.tvdbId)
    if (!series) {
      logger.debug(`Series with TVDB ID ${lookup.tvdbId} not found in Sonarr`, 'MediaService')
      return null
    }

    // Get all episodes for the series
    const episodes = await sonarrService.getEpisodes(series.id)
    const targetEpisode = episodes.find(
      ep => ep.seasonNumber === season && ep.episodeNumber === episode
    )

    if (!targetEpisode) {
      logger.debug(`Episode S${season}E${episode} not found`, 'MediaService')
      return null
    }

    if (!targetEpisode.hasFile || !targetEpisode.episodeFileId) {
      logger.debug(`Episode S${season}E${episode} has no file`, 'MediaService')
      return null
    }

    // Get episode file info from Sonarr
    const episodeFileInfo = await this.getEpisodeFileInfo(targetEpisode.episodeFileId)
    if (!episodeFileInfo) {
      logger.debug(`Could not get episode file info`, 'MediaService')
      return null
    }

    const filePath = episodeFileInfo.path
    const fileSize = episodeFileInfo.size || 0
    const title = `${series.title} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${targetEpisode.title}`

    // Check if Jellyfin is enabled
    if (!jellyfinService.isEnabled()) {
      console.error('MediaService: Jellyfin is not configured. Please set JELLYFIN_URL and JELLYFIN_API_KEY')
      return null
    }

    // Find episode in Jellyfin
    const jellyfinItem = await jellyfinService.findEpisodeByPath(filePath)
    if (!jellyfinItem) {
      logger.debug(`Episode "${title}" not found in Jellyfin library`, 'MediaService')
      return null
    }

    // Get playback info from Jellyfin
    const playbackInfo = await jellyfinService.getPlaybackInfo(jellyfinItem.Id)
    if (!playbackInfo) {
      logger.debug(`Could not get playback info from Jellyfin for "${title}"`, 'MediaService')
      return null
    }

    logger.debug(`${title} (via Jellyfin)`, 'MediaService')
    logger.debug(`  Jellyfin ID: ${playbackInfo.jellyfinItemId}`, 'MediaService')
    logger.debug(`  Stream URL: ${playbackInfo.hlsUrl.substring(0, 80)}...`, 'MediaService')
    logger.debug(`  Audio tracks: ${playbackInfo.audioTracks.length}`, 'MediaService')
    logger.debug(`  Subtitles: ${playbackInfo.subtitles.length}`, 'MediaService')

    return {
      found: true,
      title,
      type: 'episode',
      filePath,
      fileSize,
      duration: playbackInfo.duration,
      mediaInfo: playbackInfo.mediaInfo,
      streamUrl: playbackInfo.hlsUrl,
      subtitles: playbackInfo.subtitles,
      audioTracks: playbackInfo.audioTracks,
      jellyfinItemId: playbackInfo.jellyfinItemId,
      jellyfinMediaSourceId: playbackInfo.mediaSourceId,
      jellyfinPlaySessionId: playbackInfo.playSessionId
    }
  }

  // Get episode file info from Sonarr API
  private async getEpisodeFileInfo(episodeFileId: number): Promise<{
    path: string
    size: number
    mediaInfo?: {
      audioCodec: string
      audioChannels: number
      audioLanguages: string
      videoCodec: string
      resolution: string
      runTime: string
      subtitles: string
    }
  } | null> {
    try {
      const response = await fetch(
        `${config.sonarr.url}/api/v3/episodefile/${episodeFileId}`,
        {
          headers: {
            'X-Api-Key': config.sonarr.apiKey
          }
        }
      )
      if (!response.ok) return null
      return await response.json() as any
    } catch (error) {
      console.error('MediaService: Error getting episode file:', error)
      return null
    }
  }

  // Check if service can be used (Radarr/Sonarr + Jellyfin)
  isEnabled(): boolean {
    const hasMediaManager = radarrService.isEnabled() || sonarrService.isEnabled()
    const hasJellyfin = jellyfinService.isEnabled()
    return hasMediaManager && hasJellyfin
  }
}

export const mediaService = new MediaService()
