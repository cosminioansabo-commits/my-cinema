/**
 * Download Manager Service
 * Manages downloading media for offline viewing
 */

import { offlineStorageService, type OfflineMediaItem, type DownloadProgress, type PendingDownload, type OfflineSubtitleTrack } from './offlineStorageService'
import { mediaService } from './mediaService'
import { getImageUrl } from './tmdbService'
import type { MediaDetails, Episode } from '@/types'

export interface DownloadRequest {
  media: MediaDetails
  episode?: Episode
  quality?: 'auto' | '720p' | '1080p' | '4k'
}

export interface ActiveDownload {
  id: string
  media: MediaDetails
  episode?: Episode
  progress: DownloadProgress
  abortController: AbortController
}

type DownloadEventCallback = (download: ActiveDownload) => void

class DownloadManagerService {
  private activeDownloads: Map<string, ActiveDownload> = new Map()
  private downloadQueue: DownloadRequest[] = []
  private isProcessingQueue = false
  private maxConcurrentDownloads = 2

  private listeners: {
    onProgress: DownloadEventCallback[]
    onComplete: DownloadEventCallback[]
    onError: DownloadEventCallback[]
  } = {
    onProgress: [],
    onComplete: [],
    onError: [],
  }

  /**
   * Add event listener
   */
  on(event: 'progress' | 'complete' | 'error', callback: DownloadEventCallback): () => void {
    const key = `on${event.charAt(0).toUpperCase() + event.slice(1)}` as keyof typeof this.listeners
    this.listeners[key].push(callback)
    return () => {
      const index = this.listeners[key].indexOf(callback)
      if (index > -1) {
        this.listeners[key].splice(index, 1)
      }
    }
  }

  private emit(event: 'progress' | 'complete' | 'error', download: ActiveDownload): void {
    const key = `on${event.charAt(0).toUpperCase() + event.slice(1)}` as keyof typeof this.listeners
    this.listeners[key].forEach(cb => cb(download))
  }

  /**
   * Check if download is supported
   */
  isSupported(): boolean {
    return offlineStorageService.isSupported()
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): ActiveDownload[] {
    return Array.from(this.activeDownloads.values())
  }

  /**
   * Check if media is currently downloading
   */
  isDownloading(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): boolean {
    const id = offlineStorageService.generateMediaId(tmdbId, mediaType, seasonNumber, episodeNumber)
    return this.activeDownloads.has(id)
  }

  /**
   * Get download progress
   */
  getDownloadProgress(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): DownloadProgress | null {
    const id = offlineStorageService.generateMediaId(tmdbId, mediaType, seasonNumber, episodeNumber)
    const download = this.activeDownloads.get(id)
    return download?.progress || null
  }

  /**
   * Start download
   */
  async startDownload(request: DownloadRequest): Promise<string> {
    const { media, episode } = request

    const id = offlineStorageService.generateMediaId(
      media.id,
      media.mediaType,
      episode?.seasonNumber,
      episode?.episodeNumber
    )

    // Check if already downloading
    if (this.activeDownloads.has(id)) {
      throw new Error('Already downloading this media')
    }

    // Check if already downloaded
    const isDownloaded = await offlineStorageService.isMediaDownloaded(
      media.id,
      media.mediaType,
      episode?.seasonNumber,
      episode?.episodeNumber
    )
    if (isDownloaded) {
      throw new Error('Media is already downloaded')
    }

    // Add to queue
    this.downloadQueue.push(request)
    this.processQueue()

    return id
  }

  /**
   * Process download queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return
    if (this.activeDownloads.size >= this.maxConcurrentDownloads) return
    if (this.downloadQueue.length === 0) return

    this.isProcessingQueue = true

    while (
      this.downloadQueue.length > 0 &&
      this.activeDownloads.size < this.maxConcurrentDownloads
    ) {
      const request = this.downloadQueue.shift()
      if (request) {
        this.processDownload(request).catch(console.error)
      }
    }

    this.isProcessingQueue = false
  }

  /**
   * Process a single download
   */
  private async processDownload(request: DownloadRequest): Promise<void> {
    const { media, episode, quality = 'auto' } = request

    const id = offlineStorageService.generateMediaId(
      media.id,
      media.mediaType,
      episode?.seasonNumber,
      episode?.episodeNumber
    )

    console.log('[DownloadManager] Processing download:', id, media.title)

    const abortController = new AbortController()

    const activeDownload: ActiveDownload = {
      id,
      media,
      episode,
      progress: {
        id,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        status: 'pending',
      },
      abortController,
    }

    this.activeDownloads.set(id, activeDownload)
    this.emit('progress', activeDownload)

    try {
      // Get playback info from Jellyfin
      console.log('[DownloadManager] Fetching playback info...')
      let playbackInfo
      if (episode) {
        playbackInfo = await mediaService.getEpisodePlayback(
          media.id,
          episode.seasonNumber,
          episode.episodeNumber
        )
      } else {
        playbackInfo = await mediaService.getMoviePlayback(media.id)
      }

      console.log('[DownloadManager] Playback info:', playbackInfo)

      if (!playbackInfo?.jellyfinItemId || !playbackInfo?.jellyfinMediaSourceId) {
        throw new Error('No download info available for this media. Make sure the movie is in your library and Jellyfin has scanned it.')
      }

      // Use direct download proxy instead of HLS stream
      const downloadUrl = mediaService.getDownloadUrl(
        playbackInfo.jellyfinItemId,
        playbackInfo.jellyfinMediaSourceId
      )
      console.log('[DownloadManager] Download URL:', downloadUrl)

      // Update status to downloading
      activeDownload.progress.status = 'downloading'
      this.emit('progress', activeDownload)

      // Save pending download state for recovery after page refresh
      const pendingDownload: PendingDownload = {
        id,
        tmdbId: media.id,
        mediaType: media.mediaType,
        title: media.title,
        posterPath: media.posterPath,
        seasonNumber: episode?.seasonNumber,
        episodeNumber: episode?.episodeNumber,
        episodeName: episode?.name,
        downloadedBytes: 0,
        totalBytes: playbackInfo.fileSize || 0,
        startedAt: Date.now(),
      }
      await offlineStorageService.savePendingDownload(pendingDownload)

      // Generate cache keys
      const videoCacheKey = `offline-video-${id}`
      const posterCacheKey = media.posterPath ? `offline-poster-${id}` : undefined

      // Download video with progress tracking
      const fileSize = await offlineStorageService.cacheVideo(
        downloadUrl,
        videoCacheKey,
        (progress) => {
          activeDownload.progress = progress
          this.emit('progress', activeDownload)
        },
        abortController.signal
      )

      // Download poster image
      if (posterCacheKey && media.posterPath) {
        try {
          const posterUrl = getImageUrl(media.posterPath, 'w500')
          if (posterUrl) {
            await offlineStorageService.cacheImage(posterUrl, posterCacheKey)
          }
        } catch (e) {
          console.warn('Failed to cache poster:', e)
        }
      }

      // Download subtitles if available
      const offlineSubtitles: OfflineSubtitleTrack[] = []
      if (playbackInfo.subtitles && playbackInfo.subtitles.length > 0) {
        console.log('[DownloadManager] Downloading subtitles:', playbackInfo.subtitles.length)
        for (const subtitle of playbackInfo.subtitles) {
          if (subtitle.url) {
            try {
              const subtitleCacheKey = `offline-subtitle-${id}-${subtitle.streamIndex}`
              await offlineStorageService.cacheSubtitle(subtitle.url, subtitleCacheKey)
              offlineSubtitles.push({
                id: subtitle.id,
                streamIndex: subtitle.streamIndex,
                language: subtitle.language,
                languageCode: subtitle.languageCode,
                displayTitle: subtitle.displayTitle,
                format: subtitle.format,
                cacheKey: subtitleCacheKey,
              })
              console.log('[DownloadManager] Cached subtitle:', subtitle.displayTitle)
            } catch (e) {
              console.warn('Failed to cache subtitle:', subtitle.displayTitle, e)
            }
          }
        }
      }

      // Save metadata
      const offlineItem: OfflineMediaItem = {
        id,
        tmdbId: media.id,
        mediaType: media.mediaType,
        title: media.title,
        posterPath: media.posterPath,
        backdropPath: media.backdropPath,
        overview: media.overview,
        releaseDate: media.releaseDate,
        runtime: media.runtime || null,
        seasonNumber: episode?.seasonNumber,
        episodeNumber: episode?.episodeNumber,
        episodeTitle: episode?.name,
        downloadedAt: Date.now(),
        fileSize,
        duration: playbackInfo.duration ? playbackInfo.duration / 1000 : (media.runtime || 0) * 60,
        quality,
        videoCacheKey,
        posterCacheKey,
        subtitles: offlineSubtitles.length > 0 ? offlineSubtitles : undefined,
      }

      await offlineStorageService.saveMediaMetadata(offlineItem)

      // Remove from pending downloads
      await offlineStorageService.removePendingDownload(id)

      // Update progress to completed
      activeDownload.progress.status = 'completed'
      activeDownload.progress.progress = 100
      this.emit('complete', activeDownload)

    } catch (error) {
      console.error('[DownloadManager] Download failed:', error)
      activeDownload.progress.status = 'error'
      activeDownload.progress.error = error instanceof Error ? error.message : 'Download failed'
      // Remove from pending downloads on error
      await offlineStorageService.removePendingDownload(id)
      this.emit('error', activeDownload)
    } finally {
      console.log('[DownloadManager] Download finished, removing from active:', id)
      this.activeDownloads.delete(id)
      this.processQueue()
    }
  }

  /**
   * Cancel download
   */
  cancelDownload(id: string): void {
    const download = this.activeDownloads.get(id)
    if (download) {
      download.abortController.abort()
      download.progress.status = 'error'
      download.progress.error = 'Download cancelled'
      this.emit('error', download)
      this.activeDownloads.delete(id)
    }

    // Remove from queue if pending
    const queueIndex = this.downloadQueue.findIndex(req => {
      const reqId = offlineStorageService.generateMediaId(
        req.media.id,
        req.media.mediaType,
        req.episode?.seasonNumber,
        req.episode?.episodeNumber
      )
      return reqId === id
    })
    if (queueIndex > -1) {
      this.downloadQueue.splice(queueIndex, 1)
    }

    this.processQueue()
  }

  /**
   * Pause download (moves to queue)
   */
  pauseDownload(id: string): void {
    const download = this.activeDownloads.get(id)
    if (download) {
      download.abortController.abort()
      download.progress.status = 'paused'
      this.emit('progress', download)
      this.activeDownloads.delete(id)
    }
  }

  /**
   * Resume download
   */
  async resumeDownload(id: string): Promise<void> {
    // For now, we restart the download
    // A more sophisticated implementation would track byte ranges
    const download = this.activeDownloads.get(id)
    if (download) {
      await this.startDownload({
        media: download.media,
        episode: download.episode,
      })
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.downloadQueue.length
  }

  /**
   * Clear completed/errored downloads from tracking
   */
  clearCompleted(): void {
    for (const [id, download] of this.activeDownloads) {
      if (download.progress.status === 'completed' || download.progress.status === 'error') {
        this.activeDownloads.delete(id)
      }
    }
  }

  /**
   * Get pending (interrupted) downloads from storage
   */
  async getInterruptedDownloads(): Promise<PendingDownload[]> {
    return offlineStorageService.getPendingDownloads()
  }

  /**
   * Clear an interrupted download
   */
  async clearInterruptedDownload(id: string): Promise<void> {
    await offlineStorageService.removePendingDownload(id)
  }

  /**
   * Clear all interrupted downloads
   */
  async clearAllInterruptedDownloads(): Promise<void> {
    await offlineStorageService.clearPendingDownloads()
  }
}

export const downloadManagerService = new DownloadManagerService()
