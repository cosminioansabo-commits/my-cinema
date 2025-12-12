import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { ProgressUpdate, WSMessage } from '../types/index.js'
import { downloadManager } from '../services/downloadManager.js'

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  // Subscribe to download manager progress
  downloadManager.onProgress((update: ProgressUpdate) => {
    broadcast(wss, update)
  })

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected')

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
      console.log('WebSocket client disconnected')
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
      console.log('Unknown message type:', message.type)
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
