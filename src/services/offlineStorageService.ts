/**
 * Offline Storage Service
 * Uses IndexedDB for metadata and Cache API for media files
 */

export interface OfflineSubtitleTrack {
  id: number
  streamIndex: number
  language: string
  languageCode: string
  displayTitle: string
  format: string
  cacheKey: string // Key for cached subtitle file
}

export interface OfflineMediaItem {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  backdropPath: string | null
  overview: string
  releaseDate: string
  runtime: number | null
  // For TV episodes
  seasonNumber?: number
  episodeNumber?: number
  episodeTitle?: string
  // Download info
  downloadedAt: number
  fileSize: number
  duration: number // in seconds
  quality: string
  // Cache keys
  videoCacheKey: string
  posterCacheKey?: string
  // Subtitles
  subtitles?: OfflineSubtitleTrack[]
  // Playback state
  lastPlayedAt?: number
  playbackPosition?: number
}

export interface DownloadProgress {
  id: string
  progress: number // 0-100
  downloadedBytes: number
  totalBytes: number
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error'
  error?: string
}

const DB_NAME = 'my-cinema-offline'
const DB_VERSION = 2
const STORE_NAME = 'offline-media'
const PENDING_DOWNLOADS_STORE = 'pending-downloads'
const CACHE_NAME = 'my-cinema-offline-media'

export interface PendingDownload {
  id: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  seasonNumber?: number
  episodeNumber?: number
  episodeName?: string
  downloadedBytes: number
  totalBytes: number
  startedAt: number
}

class OfflineStorageService {
  private db: IDBDatabase | null = null
  private dbReady: Promise<IDBDatabase>

  constructor() {
    this.dbReady = this.initDB()
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store for offline media metadata
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('tmdbId', 'tmdbId', { unique: false })
          store.createIndex('mediaType', 'mediaType', { unique: false })
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false })
        }

        // Create object store for pending downloads (v2)
        if (!db.objectStoreNames.contains(PENDING_DOWNLOADS_STORE)) {
          db.createObjectStore(PENDING_DOWNLOADS_STORE, { keyPath: 'id' })
        }
      }
    })
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    return this.dbReady
  }

  /**
   * Check if offline storage is supported
   */
  isSupported(): boolean {
    return 'indexedDB' in window
  }

  /**
   * Get estimated storage usage and quota
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        available: (estimate.quota || 0) - (estimate.usage || 0),
      }
    }
    return { usage: 0, quota: 0, available: 0 }
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      return navigator.storage.persist()
    }
    return false
  }

  /**
   * Save offline media metadata
   */
  async saveMediaMetadata(item: OfflineMediaItem): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save media metadata'))
    })
  }

  /**
   * Get offline media metadata by ID
   */
  async getMediaMetadata(id: string): Promise<OfflineMediaItem | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to get media metadata'))
    })
  }

  /**
   * Get all offline media
   */
  async getAllMedia(): Promise<OfflineMediaItem[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error('Failed to get all media'))
    })
  }

  /**
   * Check if media is downloaded
   */
  async isMediaDownloaded(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): Promise<boolean> {
    const id = this.generateMediaId(tmdbId, mediaType, seasonNumber, episodeNumber)
    const metadata = await this.getMediaMetadata(id)
    return metadata !== null
  }

  /**
   * Delete offline media
   */
  async deleteMedia(id: string): Promise<void> {
    const db = await this.getDB()
    const metadata = await this.getMediaMetadata(id)

    if (metadata) {
      // Delete from cache
      const cache = await caches.open(CACHE_NAME)
      await cache.delete(metadata.videoCacheKey)
      if (metadata.posterCacheKey) {
        await cache.delete(metadata.posterCacheKey)
      }
    }

    // Delete metadata from IndexedDB
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to delete media'))
    })
  }

  /**
   * Clear all offline media
   */
  async clearAllMedia(): Promise<void> {
    const db = await this.getDB()

    // Clear cache
    await caches.delete(CACHE_NAME)

    // Clear IndexedDB store
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear all media'))
    })
  }

  /**
   * Save video to cache
   */
  async cacheVideo(url: string, cacheKey: string, onProgress?: (progress: DownloadProgress) => void, signal?: AbortSignal): Promise<number> {
    const cache = await caches.open(CACHE_NAME)

    // Use fetch with streaming to track progress
    const headers: Record<string, string> = {}
    const token = localStorage.getItem('my-cinema-auth-token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(url, { signal, headers })

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`)
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const chunks: Uint8Array[] = []
    let downloadedBytes = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      downloadedBytes += value.length

      if (onProgress) {
        onProgress({
          id: cacheKey,
          progress: contentLength > 0 ? (downloadedBytes / contentLength) * 100 : 0,
          downloadedBytes,
          totalBytes: contentLength,
          status: 'downloading',
        })
      }
    }

    // Combine chunks into a single blob
    const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') || 'video/mp4' })
    const cachedResponse = new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'video/mp4',
        'Content-Length': String(blob.size),
      },
    })

    await cache.put(cacheKey, cachedResponse)
    return blob.size
  }

  /**
   * Cache an image (poster/backdrop)
   * Uses no-cors mode for cross-origin images (like TMDB)
   * Opaque responses can still be cached and used by img tags
   */
  async cacheImage(url: string, cacheKey: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME)
    try {
      // Try with cors first (same-origin or CORS-enabled images)
      const response = await fetch(url)
      if (response.ok) {
        await cache.put(cacheKey, response)
        return
      }
    } catch {
      // If CORS fails, try no-cors mode for cross-origin images
      // This returns an opaque response (type: 'opaque') which can still be cached
      // and used by <img> tags, but we can't read its contents
      try {
        const response = await fetch(url, { mode: 'no-cors' })
        // Opaque responses have status 0, but are still cacheable
        await cache.put(cacheKey, response)
      } catch (error) {
        console.warn(`Failed to cache image: ${url}`, error)
      }
    }
  }

  /**
   * Get cached video URL
   */
  async getCachedVideoUrl(cacheKey: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(cacheKey)

    if (!response) return null

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /**
   * Get cached image URL
   * For opaque responses (CORS-blocked images), returns the cache key as URL
   * since opaque blobs can't be read but img tags can still use cached responses
   */
  async getCachedImageUrl(cacheKey: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(cacheKey)

    if (!response) return null

    // Opaque responses (from no-cors requests) have type 'opaque'
    // They can't be read as blobs, but img tags can use them via cache
    if (response.type === 'opaque') {
      // Return the original cache key (which is the URL) for img tag to fetch from cache
      return cacheKey
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /**
   * Cache a subtitle file (VTT/SRT)
   */
  async cacheSubtitle(url: string, cacheKey: string): Promise<void> {
    const cache = await caches.open(CACHE_NAME)
    const headers: Record<string, string> = {}
    const token = localStorage.getItem('my-cinema-auth-token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, { headers })
      if (response.ok) {
        // Clone response before caching
        const clonedResponse = response.clone()
        await cache.put(cacheKey, clonedResponse)
      } else {
        console.warn(`Failed to cache subtitle: ${url}, status: ${response.status}`)
      }
    } catch (error) {
      console.warn(`Failed to cache subtitle: ${url}`, error)
    }
  }

  /**
   * Get cached subtitle URL (as blob URL)
   */
  async getCachedSubtitleUrl(cacheKey: string): Promise<string | null> {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(cacheKey)

    if (!response) return null

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  /**
   * Update playback position
   */
  async updatePlaybackPosition(id: string, position: number): Promise<void> {
    const metadata = await this.getMediaMetadata(id)
    if (metadata) {
      metadata.playbackPosition = position
      metadata.lastPlayedAt = Date.now()
      await this.saveMediaMetadata(metadata)
    }
  }

  /**
   * Generate unique media ID
   */
  generateMediaId(tmdbId: number, mediaType: 'movie' | 'tv', seasonNumber?: number, episodeNumber?: number): string {
    if (mediaType === 'tv' && seasonNumber !== undefined && episodeNumber !== undefined) {
      return `${mediaType}-${tmdbId}-s${seasonNumber}e${episodeNumber}`
    }
    return `${mediaType}-${tmdbId}`
  }

  /**
   * Get total size of offline media
   */
  async getTotalSize(): Promise<number> {
    const media = await this.getAllMedia()
    return media.reduce((total, item) => total + item.fileSize, 0)
  }

  /**
   * Save pending download state
   */
  async savePendingDownload(download: PendingDownload): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_DOWNLOADS_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_DOWNLOADS_STORE)
      const request = store.put(download)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save pending download'))
    })
  }

  /**
   * Get all pending downloads
   */
  async getPendingDownloads(): Promise<PendingDownload[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_DOWNLOADS_STORE], 'readonly')
      const store = transaction.objectStore(PENDING_DOWNLOADS_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error('Failed to get pending downloads'))
    })
  }

  /**
   * Remove pending download
   */
  async removePendingDownload(id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_DOWNLOADS_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_DOWNLOADS_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to remove pending download'))
    })
  }

  /**
   * Clear all pending downloads
   */
  async clearPendingDownloads(): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_DOWNLOADS_STORE], 'readwrite')
      const store = transaction.objectStore(PENDING_DOWNLOADS_STORE)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear pending downloads'))
    })
  }
}

export const offlineStorageService = new OfflineStorageService()
