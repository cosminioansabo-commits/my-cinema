export interface TorrentResult {
  id: string
  name: string
  magnetLink: string
  size: string
  sizeBytes: number
  seeds: number
  peers: number
  quality?: string
  codec?: string
  source: 'yts' | '1337x' | 'torrentio' | 'radarr' | 'sonarr' | 'prowlarr'
  uploadDate?: string
}

export interface Download {
  id: string
  infoHash: string
  mediaId?: number
  mediaType?: 'movie' | 'tv'
  name: string
  status: DownloadStatus
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  size: number
  downloaded: number
  eta?: number
  savePath: string
  createdAt: string
  completedAt?: string
  error?: string
  magnetLink?: string
}

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error'

export interface SearchQuery {
  title: string
  year?: number
  type?: 'movie' | 'tv'
}

export interface ProgressUpdate {
  type: 'progress' | 'status' | 'error' | 'complete' | 'init'
  downloadId?: string
  downloads?: Download[]
  data?: Partial<Download>
}
