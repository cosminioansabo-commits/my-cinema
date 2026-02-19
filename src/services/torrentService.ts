import axios from 'axios'
import type { TorrentResult, Download, SearchQuery, ProgressUpdate } from '@/types/torrent'
import { setupAuthInterceptor } from '@/composables/useAuthInterceptor'
import { useAuthStore } from '@/stores/authStore'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${API_BASE}/api/torrents`,
  timeout: 30000
})

// Setup auth interceptor
setupAuthInterceptor(api)

export const torrentService = {
  async search(query: SearchQuery): Promise<{ results: TorrentResult[]; providers: string[] }> {
    const params: Record<string, string | number> = {
      title: query.title
    }

    if (query.year) {
      params.year = query.year
    }

    if (query.type) {
      params.type = query.type
    }

    const response = await api.get('/search', { params })
    return response.data
  },

  async startDownload(magnetLink: string, mediaId?: number, mediaType?: 'movie' | 'tv', name?: string): Promise<Download> {
    const response = await api.post('/download', {
      magnetLink,
      mediaId,
      mediaType,
      name
    })
    return response.data.download
  },

  async getDownloads(): Promise<Download[]> {
    const response = await api.get('/downloads')
    return response.data.downloads
  },

  async getDownload(id: string): Promise<Download> {
    const response = await api.get(`/downloads/${id}`)
    return response.data.download
  },

  async pauseDownload(id: string): Promise<void> {
    await api.put(`/downloads/${id}/pause`)
  },

  async resumeDownload(id: string): Promise<void> {
    await api.put(`/downloads/${id}/resume`)
  },

  async cancelDownload(id: string): Promise<void> {
    await api.delete(`/downloads/${id}`)
  },

  createWebSocket(onMessage: (update: ProgressUpdate) => void): WebSocket {
    const authStore = useAuthStore()
    let wsUrl: string
    if (API_BASE && !API_BASE.startsWith('/')) {
      // Direct backend URL (e.g., http://localhost:3001)
      wsUrl = API_BASE.replace('http', 'ws') + '/ws'
    } else {
      // Behind reverse proxy — derive WebSocket URL from current page origin
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}/ws`
    }

    // Add token to WebSocket URL if authenticated
    if (authStore.token) {
      wsUrl += `?token=${encodeURIComponent(authStore.token)}`
    }

    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as ProgressUpdate
        onMessage(update)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    return ws
  }
}
