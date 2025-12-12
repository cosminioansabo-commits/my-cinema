import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

const downloadPath = process.env.DOWNLOAD_PATH || path.join(process.env.HOME || '/tmp', 'Downloads', 'my-cinema')

// Ensure download directory exists
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath, { recursive: true })
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  downloadPath,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // WebTorrent settings
  torrent: {
    maxConnections: 100,
    uploadLimit: -1,  // Unlimited
    downloadLimit: -1 // Unlimited
  },

  // Radarr settings (for movies)
  radarr: {
    url: process.env.RADARR_URL || 'http://localhost:7878',
    apiKey: process.env.RADARR_API_KEY || '',
    enabled: !!process.env.RADARR_API_KEY
  },

  // Sonarr settings (for TV shows)
  sonarr: {
    url: process.env.SONARR_URL || 'http://localhost:8989',
    apiKey: process.env.SONARR_API_KEY || '',
    enabled: !!process.env.SONARR_API_KEY
  },

  // Prowlarr settings (indexer aggregator)
  prowlarr: {
    url: process.env.PROWLARR_URL || 'http://localhost:9696',
    apiKey: process.env.PROWLARR_API_KEY || '',
    enabled: !!process.env.PROWLARR_API_KEY
  },

  // Search providers configuration
  // Available: prowlarr, torrentio, yts
  searchProviders: (process.env.SEARCH_PROVIDERS || 'prowlarr,torrentio')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0),

  // qBittorrent settings
  qbittorrent: {
    url: process.env.QBITTORRENT_URL || 'http://localhost:8080',
    username: process.env.QBITTORRENT_USERNAME || 'admin',
    password: process.env.QBITTORRENT_PASSWORD || '',
    enabled: !!process.env.QBITTORRENT_URL && !!process.env.QBITTORRENT_PASSWORD
  }
}
