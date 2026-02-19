import axios, { AxiosInstance } from 'axios'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface QBitTorrent {
  hash: string
  name: string
  size: number
  progress: number
  dlspeed: number
  upspeed: number
  num_seeds: number
  num_leechs: number
  state: string
  eta: number
  added_on: number
  completion_on: number
  save_path: string
  category: string
  tags: string
  downloaded: number
  uploaded: number
}

interface QBitTorrentProperties {
  save_path: string
  creation_date: number
  piece_size: number
  comment: string
  total_wasted: number
  total_uploaded: number
  total_downloaded: number
  up_limit: number
  dl_limit: number
  time_elapsed: number
  seeding_time: number
  nb_connections: number
  share_ratio: number
}

type TorrentState =
  | 'error'
  | 'missingFiles'
  | 'uploading'
  | 'pausedUP'
  | 'queuedUP'
  | 'stalledUP'
  | 'checkingUP'
  | 'forcedUP'
  | 'allocating'
  | 'downloading'
  | 'metaDL'
  | 'pausedDL'
  | 'queuedDL'
  | 'stalledDL'
  | 'checkingDL'
  | 'forcedDL'
  | 'checkingResumeData'
  | 'moving'
  | 'unknown'

class QBittorrentService {
  private client: AxiosInstance
  private cookie: string | null = null
  private lastLogin: number = 0
  private readonly sessionTimeout = 30 * 60 * 1000 // 30 minutes

  constructor() {
    this.client = axios.create({
      baseURL: config.qbittorrent.url,
      timeout: 30000,
      withCredentials: true
    })
  }

  private async ensureAuthenticated(): Promise<void> {
    // Check if we need to re-authenticate
    if (this.cookie && Date.now() - this.lastLogin < this.sessionTimeout) {
      return
    }

    await this.login()
  }

  async login(): Promise<boolean> {
    try {
      const response = await this.client.post(
        '/api/v2/auth/login',
        new URLSearchParams({
          username: config.qbittorrent.username,
          password: config.qbittorrent.password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      if (response.data === 'Ok.') {
        // Extract cookie from response
        const setCookie = response.headers['set-cookie']
        if (setCookie && setCookie.length > 0) {
          this.cookie = setCookie[0].split(';')[0]
          this.lastLogin = Date.now()
          logger.debug('Logged in successfully', 'qBittorrent')
          return true
        }
      }

      console.error('qBittorrent: Login failed - invalid response')
      return false
    } catch (error) {
      console.error('qBittorrent: Login error:', error)
      return false
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.cookie) {
      headers['Cookie'] = this.cookie
    }
    return headers
  }

  async addTorrent(magnetOrUrl: string, options?: {
    savePath?: string
    category?: string
    tags?: string
    paused?: boolean
  }): Promise<boolean> {
    await this.ensureAuthenticated()

    try {
      const formData = new URLSearchParams()

      // Check if it's a magnet link or a download URL (for private trackers)
      if (magnetOrUrl.startsWith('magnet:')) {
        formData.append('urls', magnetOrUrl)
      } else {
        // For private tracker .torrent URLs, we need to download and upload the file
        // qBittorrent can handle HTTP URLs directly
        formData.append('urls', magnetOrUrl)
      }

      if (options?.savePath) {
        formData.append('savepath', options.savePath)
      }
      if (options?.category) {
        formData.append('category', options.category)
      }
      if (options?.tags) {
        formData.append('tags', options.tags)
      }
      if (options?.paused) {
        formData.append('paused', 'true')
      }

      const response = await this.client.post(
        '/api/v2/torrents/add',
        formData,
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      return response.status === 200
    } catch (error) {
      console.error('qBittorrent: Error adding torrent:', error)
      return false
    }
  }

  async addTorrentFile(torrentBuffer: Buffer, filename: string, options?: {
    savePath?: string
    category?: string
    tags?: string
    paused?: boolean
  }): Promise<boolean> {
    await this.ensureAuthenticated()

    try {
      // Create multipart form data
      const FormData = (await import('form-data')).default
      const form = new FormData()

      form.append('torrents', torrentBuffer, {
        filename: filename,
        contentType: 'application/x-bittorrent'
      })

      if (options?.savePath) {
        form.append('savepath', options.savePath)
      }
      if (options?.category) {
        form.append('category', options.category)
      }
      if (options?.tags) {
        form.append('tags', options.tags)
      }
      if (options?.paused) {
        form.append('paused', 'true')
      }

      const response = await this.client.post(
        '/api/v2/torrents/add',
        form,
        {
          headers: {
            ...this.getHeaders(),
            ...form.getHeaders()
          }
        }
      )

      return response.status === 200
    } catch (error) {
      console.error('qBittorrent: Error adding torrent file:', error)
      return false
    }
  }

  async getTorrents(filter?: 'all' | 'downloading' | 'seeding' | 'completed' | 'paused' | 'active' | 'inactive'): Promise<QBitTorrent[]> {
    await this.ensureAuthenticated()

    try {
      const params: Record<string, string> = {}
      if (filter) {
        params.filter = filter
      }

      const response = await this.client.get('/api/v2/torrents/info', {
        params,
        headers: this.getHeaders()
      })

      return response.data as QBitTorrent[]
    } catch (error) {
      console.error('qBittorrent: Error getting torrents:', error)
      return []
    }
  }

  async getTorrent(hash: string): Promise<QBitTorrent | null> {
    await this.ensureAuthenticated()

    try {
      const response = await this.client.get('/api/v2/torrents/info', {
        params: { hashes: hash },
        headers: this.getHeaders()
      })

      const torrents = response.data as QBitTorrent[]
      return torrents.length > 0 ? torrents[0] : null
    } catch (error) {
      console.error('qBittorrent: Error getting torrent:', error)
      return null
    }
  }

  async getTorrentProperties(hash: string): Promise<QBitTorrentProperties | null> {
    await this.ensureAuthenticated()

    try {
      const response = await this.client.get('/api/v2/torrents/properties', {
        params: { hash },
        headers: this.getHeaders()
      })

      return response.data as QBitTorrentProperties
    } catch (error) {
      console.error('qBittorrent: Error getting torrent properties:', error)
      return null
    }
  }

  async pauseTorrent(hash: string): Promise<boolean> {
    await this.ensureAuthenticated()

    try {
      await this.client.post(
        '/api/v2/torrents/pause',
        new URLSearchParams({ hashes: hash }),
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      return true
    } catch (error) {
      console.error('qBittorrent: Error pausing torrent:', error)
      return false
    }
  }

  async resumeTorrent(hash: string): Promise<boolean> {
    await this.ensureAuthenticated()

    try {
      await this.client.post(
        '/api/v2/torrents/resume',
        new URLSearchParams({ hashes: hash }),
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      return true
    } catch (error) {
      console.error('qBittorrent: Error resuming torrent:', error)
      return false
    }
  }

  async deleteTorrent(hash: string, deleteFiles: boolean = false): Promise<boolean> {
    await this.ensureAuthenticated()

    try {
      await this.client.post(
        '/api/v2/torrents/delete',
        new URLSearchParams({
          hashes: hash,
          deleteFiles: deleteFiles.toString()
        }),
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
      return true
    } catch (error) {
      console.error('qBittorrent: Error deleting torrent:', error)
      return false
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const response = await this.client.get('/api/v2/app/version', {
        headers: this.getHeaders()
      })
      return response.data
    } catch (error) {
      return null
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const loggedIn = await this.login()
      if (!loggedIn) return false

      const version = await this.getVersion()
      if (version) {
        logger.debug(`Connected to version ${version}`, 'qBittorrent')
        return true
      }
      return false
    } catch (error) {
      console.error('qBittorrent: Connection test failed:', error)
      return false
    }
  }

  mapStateToStatus(state: string): 'queued' | 'downloading' | 'paused' | 'completed' | 'error' {
    switch (state) {
      case 'error':
      case 'missingFiles':
        return 'error'
      case 'uploading':
      case 'pausedUP':
      case 'queuedUP':
      case 'stalledUP':
      case 'checkingUP':
      case 'forcedUP':
        return 'completed'
      case 'pausedDL':
        return 'paused'
      case 'queuedDL':
      case 'checkingResumeData':
        return 'queued'
      case 'downloading':
      case 'metaDL':
      case 'stalledDL':
      case 'checkingDL':
      case 'forcedDL':
      case 'allocating':
      case 'moving':
      default:
        return 'downloading'
    }
  }
}

export const qbittorrentService = new QBittorrentService()
