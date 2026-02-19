import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import type { Download, DownloadRequest, ProgressUpdate } from '../types/index.js'
import { config } from '../config.js'
import { qbittorrentService } from './qbittorrentService.js'
import { logger } from '../utils/logger.js'

type ProgressCallback = (update: ProgressUpdate) => void

// Base32 to hex conversion for info hashes
function base32ToHex(base32: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''

  for (const char of base32.toUpperCase()) {
    const index = alphabet.indexOf(char)
    if (index === -1) continue
    bits += index.toString(2).padStart(5, '0')
  }

  let hex = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }

  return hex.toLowerCase()
}

// Extract info hash from magnet link (handles both hex and base32)
function extractInfoHash(magnetLink: string): string | null {
  // Try hex format first (40 characters)
  const hexMatch = magnetLink.match(/urn:btih:([a-fA-F0-9]{40})/i)
  if (hexMatch) {
    return hexMatch[1].toLowerCase()
  }

  // Try base32 format (32 characters) - needs conversion to hex
  const base32Match = magnetLink.match(/urn:btih:([A-Za-z2-7]{32})/i)
  if (base32Match) {
    return base32ToHex(base32Match[1])
  }

  return null
}

// Categories for Radarr/Sonarr integration
const CATEGORIES = {
  movie: 'radarr',
  tv: 'sonarr'
} as const

class DownloadManager {
  private downloads: Map<string, Download> = new Map()
  private hashToId: Map<string, string> = new Map() // Map qBittorrent hash to our internal ID
  private progressCallbacks: Set<ProgressCallback> = new Set()
  private pollingInterval: NodeJS.Timeout | null = null
  private stateFilePath: string

  constructor() {
    this.stateFilePath = path.join(config.downloadPath, '.downloads-state.json')

    // Ensure download directory exists
    if (!fs.existsSync(config.downloadPath)) {
      fs.mkdirSync(config.downloadPath, { recursive: true })
    }

    // Load persisted state
    this.loadState()

    // Start polling for progress updates
    this.startPolling()
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf-8')
        const state = JSON.parse(data) as Download[]

        for (const download of state) {
          this.downloads.set(download.id, download)
          if (download.infoHash) {
            this.hashToId.set(download.infoHash.toLowerCase(), download.id)
          }
        }

        logger.debug(`Loaded ${this.downloads.size} downloads from state`, 'DownloadManager')
      }
    } catch (error) {
      console.error('Error loading state:', error)
    }
  }

  private saveState(): void {
    try {
      const state = Array.from(this.downloads.values())
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2))
    } catch (error) {
      console.error('Error saving state:', error)
    }
  }

  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  private emitProgress(update: ProgressUpdate): void {
    for (const callback of this.progressCallbacks) {
      callback(update)
    }
  }

  private updateDownload(id: string, updates: Partial<Download>): void {
    const download = this.downloads.get(id)
    if (download) {
      Object.assign(download, updates)
      this.saveState()
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return

    // Poll qBittorrent every 2 seconds for progress updates
    this.pollingInterval = setInterval(async () => {
      await this.syncWithQBittorrent()
    }, 2000)
  }

  private async syncWithQBittorrent(): Promise<void> {
    if (!config.qbittorrent.enabled) return

    try {
      const torrents = await qbittorrentService.getTorrents()

      for (const torrent of torrents) {
        const hash = torrent.hash.toLowerCase()
        let downloadId = this.hashToId.get(hash)

        // If not found by hash, try to match downloads without hash by name
        if (!downloadId) {
          for (const [id, download] of this.downloads) {
            if (!download.infoHash && download.status !== 'completed' && download.status !== 'error') {
              // Match by torrent name (case-insensitive partial match)
              if (torrent.name.toLowerCase().includes(download.name.toLowerCase().slice(0, 20)) ||
                  download.name.toLowerCase().includes(torrent.name.toLowerCase().slice(0, 20))) {
                download.infoHash = hash
                this.hashToId.set(hash, id)
                this.saveState()
                downloadId = id
                logger.debug(`Matched download "${download.name}" to torrent hash ${hash}`, 'DownloadManager')
                break
              }
            }
          }
        }

        if (!downloadId) continue

        const download = this.downloads.get(downloadId)
        if (!download) continue

        const newStatus = qbittorrentService.mapStateToStatus(torrent.state)
        const progress = Math.round(torrent.progress * 100)

        // Check if anything changed
        const statusChanged = download.status !== newStatus
        const progressChanged = download.progress !== progress

        if (statusChanged || progressChanged) {
          const updates: Partial<Download> = {
            status: newStatus,
            progress,
            downloadSpeed: torrent.dlspeed,
            uploadSpeed: torrent.upspeed,
            downloaded: torrent.downloaded,
            size: torrent.size,
            eta: torrent.eta > 0 && torrent.eta < 8640000 ? torrent.eta : undefined
          }

          if (newStatus === 'completed' && !download.completedAt) {
            updates.completedAt = new Date().toISOString()
          }

          this.updateDownload(downloadId, updates)

          // Emit appropriate event
          if (newStatus === 'completed' && statusChanged) {
            this.emitProgress({
              type: 'complete',
              downloadId,
              data: { status: 'completed', progress: 100 }
            })
            logger.debug(`Download completed: ${download.name}`, 'DownloadManager')
          } else if (newStatus === 'error' && statusChanged) {
            this.emitProgress({
              type: 'error',
              downloadId,
              data: { status: 'error', error: 'Download failed' }
            })
          } else {
            this.emitProgress({
              type: 'progress',
              downloadId,
              data: updates
            })
          }
        }
      }
    } catch (error) {
      // Silently fail polling - connection might be temporarily unavailable
    }
  }

  async startDownload(request: DownloadRequest): Promise<Download> {
    const id = uuidv4()

    // Determine category based on media type
    const category = request.mediaType ? CATEGORIES[request.mediaType] : undefined

    const download: Download = {
      id,
      infoHash: '',
      mediaId: request.mediaId,
      mediaType: request.mediaType,
      name: request.name || 'Unknown',
      status: 'queued',
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      size: 0,
      downloaded: 0,
      savePath: config.downloadPath,
      createdAt: new Date().toISOString()
    }

    this.downloads.set(id, download)
    this.saveState()

    try {
      // Check if qBittorrent is enabled
      if (!config.qbittorrent.enabled) {
        throw new Error('qBittorrent is not configured. Please set QBITTORRENT_URL and QBITTORRENT_PASSWORD in your .env file.')
      }

      // Add torrent to qBittorrent
      const success = await qbittorrentService.addTorrent(request.magnetLink, {
        category,
        savePath: config.downloadPath
      })

      if (!success) {
        throw new Error('Failed to add torrent to qBittorrent')
      }

      // Extract info hash from magnet link (handles both hex and base32 formats)
      const infoHash = extractInfoHash(request.magnetLink)
      if (infoHash) {
        download.infoHash = infoHash
        this.hashToId.set(infoHash, id)
        logger.debug(`Extracted info hash: ${infoHash}`, 'DownloadManager')
      } else {
        logger.warn(`Could not extract info hash from magnet link`, 'DownloadManager')
      }

      download.status = 'downloading'
      this.saveState()

      this.emitProgress({
        type: 'status',
        downloadId: id,
        data: { status: 'downloading', name: download.name }
      })

      logger.debug(`Started download: ${download.name} (category: ${category || 'none'})`, 'DownloadManager')
      return download
    } catch (error) {
      download.status = 'error'
      download.error = error instanceof Error ? error.message : 'Unknown error'
      this.saveState()

      this.emitProgress({
        type: 'error',
        downloadId: id,
        data: { status: 'error', error: download.error }
      })

      throw error
    }
  }

  async startDownloadFromUrl(url: string, request: Omit<DownloadRequest, 'magnetLink'>): Promise<Download> {
    const id = uuidv4()
    const category = request.mediaType ? CATEGORIES[request.mediaType] : undefined

    const download: Download = {
      id,
      infoHash: '',
      mediaId: request.mediaId,
      mediaType: request.mediaType,
      name: request.name || 'Unknown',
      status: 'queued',
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      size: 0,
      downloaded: 0,
      savePath: config.downloadPath,
      createdAt: new Date().toISOString()
    }

    this.downloads.set(id, download)
    this.saveState()

    try {
      if (!config.qbittorrent.enabled) {
        throw new Error('qBittorrent is not configured')
      }

      // For private trackers, qBittorrent can download the .torrent file directly from URL
      const success = await qbittorrentService.addTorrent(url, {
        category,
        savePath: config.downloadPath
      })

      if (!success) {
        throw new Error('Failed to add torrent to qBittorrent')
      }

      download.status = 'downloading'
      this.saveState()

      this.emitProgress({
        type: 'status',
        downloadId: id,
        data: { status: 'downloading', name: download.name }
      })

      logger.debug(`Started download from URL: ${download.name} (category: ${category || 'none'})`, 'DownloadManager')
      return download
    } catch (error) {
      download.status = 'error'
      download.error = error instanceof Error ? error.message : 'Unknown error'
      this.saveState()
      throw error
    }
  }

  getDownload(id: string): Download | undefined {
    return this.downloads.get(id)
  }

  getAllDownloads(): Download[] {
    return Array.from(this.downloads.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async pauseDownload(id: string): Promise<boolean> {
    const download = this.downloads.get(id)
    if (!download || !download.infoHash) {
      return false
    }

    const success = await qbittorrentService.pauseTorrent(download.infoHash)
    if (success) {
      this.updateDownload(id, { status: 'paused', downloadSpeed: 0, uploadSpeed: 0 })
      this.emitProgress({
        type: 'status',
        downloadId: id,
        data: { status: 'paused' }
      })
    }

    return success
  }

  async resumeDownload(id: string): Promise<boolean> {
    const download = this.downloads.get(id)
    if (!download || !download.infoHash) {
      return false
    }

    const success = await qbittorrentService.resumeTorrent(download.infoHash)
    if (success) {
      this.updateDownload(id, { status: 'downloading' })
      this.emitProgress({
        type: 'status',
        downloadId: id,
        data: { status: 'downloading' }
      })
    }

    return success
  }

  async cancelDownload(id: string): Promise<boolean> {
    const download = this.downloads.get(id)
    if (!download) {
      return false
    }

    if (download.infoHash) {
      await qbittorrentService.deleteTorrent(download.infoHash, true)
      this.hashToId.delete(download.infoHash.toLowerCase())
    }

    this.downloads.delete(id)
    this.saveState()

    return true
  }

  async testQBittorrentConnection(): Promise<boolean> {
    return qbittorrentService.testConnection()
  }

  async destroy(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }
}

export const downloadManager = new DownloadManager()
