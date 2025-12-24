import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { offlineStorageService, type OfflineMediaItem, type DownloadProgress } from '@/services/offlineStorageService'
import { downloadManagerService, type ActiveDownload } from '@/services/downloadManagerService'
import type { MediaDetails, Episode } from '@/types'

export const useOfflineStore = defineStore('offline', () => {
  // State
  const offlineMedia = ref<OfflineMediaItem[]>([])
  const activeDownloads = ref<ActiveDownload[]>([])
  const isLoading = ref(false)
  const storageEstimate = ref<{ usage: number; quota: number; available: number }>({
    usage: 0,
    quota: 0,
    available: 0,
  })

  // Getters
  const offlineMovies = computed(() =>
    offlineMedia.value.filter(m => m.mediaType === 'movie')
  )

  const offlineTVEpisodes = computed(() =>
    offlineMedia.value.filter(m => m.mediaType === 'tv')
  )

  const totalOfflineSize = computed(() =>
    offlineMedia.value.reduce((total, item) => total + item.fileSize, 0)
  )

  const isDownloadSupported = computed(() =>
    downloadManagerService.isSupported()
  )

  const hasActiveDownloads = computed(() =>
    activeDownloads.value.some(d => d.progress.status === 'downloading' || d.progress.status === 'pending')
  )

  // Actions
  async function loadOfflineMedia(): Promise<void> {
    isLoading.value = true
    try {
      offlineMedia.value = await offlineStorageService.getAllMedia()
      await updateStorageEstimate()
    } catch (error) {
      console.error('Failed to load offline media:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function updateStorageEstimate(): Promise<void> {
    storageEstimate.value = await offlineStorageService.getStorageEstimate()
  }

  function isMediaDownloaded(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): boolean {
    const id = offlineStorageService.generateMediaId(tmdbId, mediaType, seasonNumber, episodeNumber)
    return offlineMedia.value.some(m => m.id === id)
  }

  function isMediaDownloading(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): boolean {
    return downloadManagerService.isDownloading(tmdbId, mediaType, seasonNumber, episodeNumber)
  }

  function getDownloadProgress(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): DownloadProgress | null {
    return downloadManagerService.getDownloadProgress(tmdbId, mediaType, seasonNumber, episodeNumber)
  }

  async function startDownload(media: MediaDetails, episode?: Episode): Promise<string> {
    const id = await downloadManagerService.startDownload({ media, episode })
    syncActiveDownloads()
    return id
  }

  function cancelDownload(id: string): void {
    downloadManagerService.cancelDownload(id)
    syncActiveDownloads()
  }

  function pauseDownload(id: string): void {
    downloadManagerService.pauseDownload(id)
    syncActiveDownloads()
  }

  async function resumeDownload(id: string): Promise<void> {
    await downloadManagerService.resumeDownload(id)
    syncActiveDownloads()
  }

  async function deleteOfflineMedia(id: string): Promise<void> {
    await offlineStorageService.deleteMedia(id)
    offlineMedia.value = offlineMedia.value.filter(m => m.id !== id)
    await updateStorageEstimate()
  }

  async function clearAllOfflineMedia(): Promise<void> {
    await offlineStorageService.clearAllMedia()
    offlineMedia.value = []
    await updateStorageEstimate()
  }

  async function getOfflineVideoUrl(id: string): Promise<string | null> {
    const metadata = await offlineStorageService.getMediaMetadata(id)
    if (!metadata) return null
    return offlineStorageService.getCachedVideoUrl(metadata.videoCacheKey)
  }

  async function getOfflinePosterUrl(id: string): Promise<string | null> {
    const metadata = await offlineStorageService.getMediaMetadata(id)
    if (!metadata?.posterCacheKey) return null
    return offlineStorageService.getCachedImageUrl(metadata.posterCacheKey)
  }

  async function updatePlaybackPosition(id: string, position: number): Promise<void> {
    await offlineStorageService.updatePlaybackPosition(id, position)
    // Update local state
    const item = offlineMedia.value.find(m => m.id === id)
    if (item) {
      item.playbackPosition = position
      item.lastPlayedAt = Date.now()
    }
  }

  function syncActiveDownloads(): void {
    activeDownloads.value = downloadManagerService.getActiveDownloads()
  }

  // Initialize event listeners
  function initializeListeners(): void {
    downloadManagerService.on('progress', () => {
      syncActiveDownloads()
    })

    downloadManagerService.on('complete', async () => {
      syncActiveDownloads()
      await loadOfflineMedia()
    })

    downloadManagerService.on('error', () => {
      syncActiveDownloads()
    })
  }

  // Format file size helper
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return {
    // State
    offlineMedia,
    activeDownloads,
    isLoading,
    storageEstimate,

    // Getters
    offlineMovies,
    offlineTVEpisodes,
    totalOfflineSize,
    isDownloadSupported,
    hasActiveDownloads,

    // Actions
    loadOfflineMedia,
    updateStorageEstimate,
    isMediaDownloaded,
    isMediaDownloading,
    getDownloadProgress,
    startDownload,
    cancelDownload,
    pauseDownload,
    resumeDownload,
    deleteOfflineMedia,
    clearAllOfflineMedia,
    getOfflineVideoUrl,
    getOfflinePosterUrl,
    updatePlaybackPosition,
    syncActiveDownloads,
    initializeListeners,
    formatFileSize,
  }
})
