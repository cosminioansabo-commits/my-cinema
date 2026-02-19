import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import type { ProgressUpdate, WSMessage } from '../types/index.js'
import { downloadManager } from '../services/downloadManagerService.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, config.auth.jwtSecret)
    return true
  } catch {
    return false
  }
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Subscribe to download manager progress
  downloadManager.onProgress((update: ProgressUpdate) => {
    broadcast(wss, update)
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Check authentication if enabled
    if (config.auth.enabled) {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const token = url.searchParams.get('token')

      if (!token || !verifyToken(token)) {
        logger.debug('Connection rejected: Invalid or missing token', 'WebSocket')
        ws.close(4001, 'Unauthorized')
        return
      }
    }

    logger.debug('Client connected', 'WebSocket')

    // Send current state of all downloads
    const downloads = downloadManager.getAllDownloads()
    ws.send(JSON.stringify({
      type: 'init',
      downloads
    }))

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage
        handleMessage(ws, message)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    })

    ws.on('close', () => {
      logger.debug('Client disconnected', 'WebSocket')
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })

  return wss
}

function handleMessage(ws: WebSocket, message: WSMessage): void {
  switch (message.type) {
    case 'subscribe':
      // Could implement per-download subscriptions if needed
      break
    case 'unsubscribe':
      break
    default:
      logger.debug(`Unknown message type: ${message.type}`, 'WebSocket')
  }
}

function broadcast(wss: WebSocketServer, data: ProgressUpdate): void {
  const message = JSON.stringify(data)

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}
