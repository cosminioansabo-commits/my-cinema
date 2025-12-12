import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { torrentService } from '@/services/torrentService'
import type { TorrentResult, Download, SearchQuery, ProgressUpdate } from '@/types/torrent'

export const useTorrentsStore = defineStore('torrents', () => {
  // State
  const searchResults = ref<TorrentResult[]>([])
  const downloads = ref<Download[]>([])
  const isSearching = ref(false)
  const searchError = ref<string | null>(null)
  const wsConnected = ref(false)

  let ws: WebSocket | null = null

  // Getters
  const activeDownloads = computed(() =>
    downloads.value.filter(d => d.status === 'downloading' || d.status === 'queued')
  )

  const completedDownloads = computed(() =>
    downloads.value.filter(d => d.status === 'completed')
  )

  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0)

  const totalProgress = computed(() => {
    const active = activeDownloads.value
    if (active.length === 0) return 0

    const total = active.reduce((sum, d) => sum + d.progress, 0)
    return Math.round(total / active.length)
  })

  // Actions
  async function search(query: SearchQuery): Promise<void> {
    isSearching.value = true
    searchError.value = null
    searchResults.value = []

    try {
      const response = await torrentService.search(query)
      searchResults.value = response.results
    } catch (error) {
      searchError.value = error instanceof Error ? error.message : 'Search failed'
      console.error('Torrent search error:', error)
    } finally {
      isSearching.value = false
    }
  }

  function clearSearch(): void {
    searchResults.value = []
    searchError.value = null
  }

  async function startDownload(torrent: TorrentResult, mediaId?: number, mediaType?: 'movie' | 'tv'): Promise<Download> {
    const download = await torrentService.startDownload(
      torrent.magnetLink,
      mediaId,
      mediaType,
      torrent.name
    )

    // Add to local state (will be updated by WebSocket)
    const existingIndex = downloads.value.findIndex(d => d.id === download.id)
    if (existingIndex === -1) {
      downloads.value.unshift(download)
    }

    return download
  }

  async function pauseDownload(id: string): Promise<void> {
    await torrentService.pauseDownload(id)

    const download = downloads.value.find(d => d.id === id)
    if (download) {
      download.status = 'paused'
    }
  }

  async function resumeDownload(id: string): Promise<void> {
    await torrentService.resumeDownload(id)

    const download = downloads.value.find(d => d.id === id)
    if (download) {
      download.status = 'downloading'
    }
  }

  async function cancelDownload(id: string): Promise<void> {
    await torrentService.cancelDownload(id)

    const index = downloads.value.findIndex(d => d.id === id)
    if (index !== -1) {
      downloads.value.splice(index, 1)
    }
  }

  async function fetchDownloads(): Promise<void> {
    try {
      downloads.value = await torrentService.getDownloads()
    } catch (error) {
      console.error('Error fetching downloads:', error)
    }
  }

  function handleProgressUpdate(update: ProgressUpdate): void {
    if (update.type === 'init' && update.downloads) {
      downloads.value = update.downloads
      return
    }

    if (!update.downloadId || !update.data) return

    const download = downloads.value.find(d => d.id === update.downloadId)
    if (download) {
      Object.assign(download, update.data)
    }
  }

  function connectWebSocket(): void {
    if (ws && ws.readyState === WebSocket.OPEN) return

    ws = torrentService.createWebSocket(handleProgressUpdate)

    ws.onopen = () => {
      wsConnected.value = true
      console.log('WebSocket connected')
    }

    ws.onclose = () => {
      wsConnected.value = false
      console.log('WebSocket disconnected')

      // Reconnect after 3 seconds
      setTimeout(() => {
        if (!wsConnected.value) {
          connectWebSocket()
        }
      }, 3000)
    }
  }

  function disconnectWebSocket(): void {
    if (ws) {
      ws.close()
      ws = null
    }
    wsConnected.value = false
  }

  return {
    // State
    searchResults,
    downloads,
    isSearching,
    searchError,
    wsConnected,

    // Getters
    activeDownloads,
    completedDownloads,
    hasActiveDownloads,
    totalProgress,

    // Actions
    search,
    clearSearch,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    fetchDownloads,
    connectWebSocket,
    disconnectWebSocket
  }
})
