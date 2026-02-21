import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import torrentRoutes from './routes/torrents.js'
import libraryRoutes from './routes/library.js'
import mediaRoutes from './routes/media.js'
import progressRoutes from './routes/progress.js'
import hlsProxyRoutes from './routes/hlsProxy.js'
import subtitleRoutes from './routes/subtitles.js'
import profileRoutes from './routes/profiles.js'
import profileLibraryRoutes from './routes/profileLibrary.js'
import { authMiddleware } from './middleware/auth.js'
import { setupWebSocket } from './websocket/progressSocket.js'
import { downloadManager } from './services/downloadManagerService.js'
import { profileLibraryService } from './services/profileLibraryService.js'
import { logger } from './utils/logger.js'

const app = express()
const server = createServer(app)

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    // Allow the configured origin
    if (origin === config.corsOrigin) return callback(null, true)
    // Allow any origin for development or if CORS_ORIGIN is set to *
    if (config.corsOrigin === '*') return callback(null, true)
    // Allow same host with different ports (for local development)
    try {
      const originUrl = new URL(origin)
      const configUrl = new URL(config.corsOrigin)
      if (originUrl.hostname === configUrl.hostname) {
        return callback(null, true)
      }
    } catch {
      // Invalid URL, reject
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json())

// Public routes (no auth required)
app.use('/api/auth', authRoutes)
app.use('/api/proxy', hlsProxyRoutes) // HLS proxy for Jellyfin streams (no auth - HLS.js can't send headers)

// Protected routes (auth required)
app.use('/api/profiles', authMiddleware, profileRoutes)
app.use('/api/profiles', authMiddleware, profileLibraryRoutes)
app.use('/api/torrents', authMiddleware, torrentRoutes)
app.use('/api/library', authMiddleware, libraryRoutes)
app.use('/api/media', authMiddleware, mediaRoutes)
app.use('/api/progress', authMiddleware, progressRoutes)
app.use('/api/subtitles', authMiddleware, subtitleRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', downloadPath: config.downloadPath })
})

// Setup WebSocket
setupWebSocket(server)

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...')
  await downloadManager.destroy()
  server.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('Shutting down...')
  await downloadManager.destroy()
  server.close()
  process.exit(0)
})

// Start server
server.listen(config.port, async () => {
  logger.info(`Server running on http://localhost:${config.port}`)
  logger.info(`Download path: ${config.downloadPath}`)
  logger.info(`CORS origin: ${config.corsOrigin}`)
  logger.info(`Auth enabled: ${config.auth.enabled}`)
  logger.info(`Jellyfin enabled: ${config.jellyfin.enabled}`)
  logger.info(`Radarr enabled: ${config.radarr.enabled}`)
  logger.info(`Sonarr enabled: ${config.sonarr.enabled}`)

  // Run initial library migration (imports existing Radarr/Sonarr content into default profile)
  try {
    await profileLibraryService.runInitialMigration()
  } catch (error) {
    console.error('Failed to run initial library migration:', error)
  }

  // Auto-repair migration data (fix missing poster_path and tmdb_id = 0)
  try {
    await profileLibraryService.repairMigrationData()
  } catch (error) {
    console.error('Failed to repair migration data:', error)
  }
})
