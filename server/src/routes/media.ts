import { Router, Request, Response } from 'express'
import axios from 'axios'
import { mediaService } from '../services/mediaService.js'
import { jellyfinService } from '../services/jellyfinService.js'
import { config } from '../config.js'

const router = Router()

// ============================================================================
// HLS PROXY ENDPOINTS (to bypass Private Network Access restrictions)
// ============================================================================

// Proxy HLS master playlist (.m3u8)
router.get('/proxy/hls/:itemId/master.m3u8', async (req: Request, res: Response) => {
  const { itemId } = req.params
  const queryParams = req.query

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  try {
    // Build the Jellyfin URL using internal URL
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) params.set(key, String(value))
    }

    const jellyfinUrl = `${config.jellyfin.url}/Videos/${itemId}/master.m3u8?${params.toString()}`

    const response = await axios.get(jellyfinUrl, {
      headers: {
        'X-Emby-Token': config.jellyfin.apiKey
      },
      responseType: 'text'
    })

    // Rewrite URLs in the manifest to point to our proxy
    let manifest = response.data as string

    // Rewrite segment URLs to go through our proxy
    // Jellyfin returns relative URLs like: hls1/main/0.ts
    manifest = manifest.replace(
      /^(hls\d+\/[^\n]+)$/gm,
      `/api/media/proxy/hls/${itemId}/$1?${params.toString()}`
    )

    // Also handle absolute URLs if Jellyfin returns them
    const jellyfinBaseUrl = config.jellyfin.url
    manifest = manifest.replace(
      new RegExp(jellyfinBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/Videos/' + itemId + '/', 'g'),
      `/api/media/proxy/hls/${itemId}/`
    )

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(manifest)
  } catch (error: any) {
    console.error('HLS proxy master error:', error.message)
    res.status(500).json({ error: 'Failed to proxy HLS manifest' })
  }
})

// Proxy HLS variant playlist (e.g., hls1/main/0.m3u8)
router.get('/proxy/hls/:itemId/:hlsPath(*).m3u8', async (req: Request, res: Response) => {
  const { itemId, hlsPath } = req.params
  const queryParams = req.query

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) params.set(key, String(value))
    }

    const jellyfinUrl = `${config.jellyfin.url}/Videos/${itemId}/${hlsPath}.m3u8?${params.toString()}`

    const response = await axios.get(jellyfinUrl, {
      headers: {
        'X-Emby-Token': config.jellyfin.apiKey
      },
      responseType: 'text'
    })

    let manifest = response.data as string

    // Rewrite segment URLs - they're typically relative like "0.ts", "1.ts"
    // Get the directory path for relative URL resolution
    const dirPath = hlsPath.includes('/') ? hlsPath.substring(0, hlsPath.lastIndexOf('/') + 1) : ''

    // Rewrite .ts segment references
    manifest = manifest.replace(
      /^(\d+\.ts.*)$/gm,
      `/api/media/proxy/hls/${itemId}/${dirPath}$1`
    )

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(manifest)
  } catch (error: any) {
    console.error('HLS proxy variant error:', error.message)
    res.status(500).json({ error: 'Failed to proxy HLS variant playlist' })
  }
})

// Proxy HLS segments (.ts files)
router.get('/proxy/hls/:itemId/:segmentPath(*).ts', async (req: Request, res: Response) => {
  const { itemId, segmentPath } = req.params
  const queryParams = req.query

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) params.set(key, String(value))
    }

    const jellyfinUrl = `${config.jellyfin.url}/Videos/${itemId}/${segmentPath}.ts?${params.toString()}`

    const response = await axios.get(jellyfinUrl, {
      headers: {
        'X-Emby-Token': config.jellyfin.apiKey
      },
      responseType: 'stream'
    })

    res.setHeader('Content-Type', 'video/mp2t')
    res.setHeader('Access-Control-Allow-Origin', '*')
    response.data.pipe(res)
  } catch (error: any) {
    console.error('HLS proxy segment error:', error.message)
    res.status(500).json({ error: 'Failed to proxy HLS segment' })
  }
})

// Proxy subtitle files from Jellyfin
router.get('/proxy/subtitles/:itemId/:mediaSourceId/:streamIndex/Stream.:format', async (req: Request, res: Response) => {
  const { itemId, mediaSourceId, streamIndex, format } = req.params

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  try {
    const jellyfinUrl = `${config.jellyfin.url}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.${format}`

    const response = await axios.get(jellyfinUrl, {
      headers: {
        'X-Emby-Token': config.jellyfin.apiKey
      },
      responseType: 'text'
    })

    const contentType = format === 'vtt' ? 'text/vtt' : 'text/plain'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(response.data)
  } catch (error: any) {
    console.error('Subtitle proxy error:', error.message)
    res.status(500).json({ error: 'Failed to proxy subtitle' })
  }
})

// ============================================================================
// PLAYBACK INFO ENDPOINTS (via Jellyfin)
// ============================================================================

// Check if media service is available
router.get('/status', async (req: Request, res: Response) => {
  const enabled = mediaService.isEnabled()
  const jellyfinEnabled = jellyfinService.isEnabled()

  res.json({
    enabled,
    connected: enabled,
    jellyfin: {
      enabled: jellyfinEnabled,
      connected: jellyfinEnabled ? await jellyfinService.testConnection() : false
    }
  })
})

// ============================================================================
// JELLYFIN INTEGRATION ENDPOINTS
// ============================================================================

// Get Jellyfin stream URL with specific audio track
router.get('/jellyfin/audio/:itemId/:audioIndex', async (req: Request, res: Response) => {
  const { itemId, audioIndex } = req.params
  const { mediaSourceId, playSessionId } = req.query

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  if (!mediaSourceId || !playSessionId) {
    res.status(400).json({ error: 'mediaSourceId and playSessionId required' })
    return
  }

  const hlsUrl = jellyfinService.getHlsUrlWithAudioTrack(
    itemId,
    mediaSourceId as string,
    playSessionId as string,
    parseInt(audioIndex, 10)
  )

  res.json({ hlsUrl })
})

// Report playback progress to Jellyfin
router.post('/jellyfin/progress', async (req: Request, res: Response) => {
  const { itemId, positionMs, isPaused } = req.body

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  // Convert ms to ticks (1 tick = 10,000 nanoseconds = 0.01 ms)
  const positionTicks = positionMs * 10000

  await jellyfinService.reportProgress(itemId, positionTicks, isPaused || false)
  res.json({ success: true })
})

// Report playback stopped to Jellyfin
router.post('/jellyfin/stopped', async (req: Request, res: Response) => {
  const { itemId, positionMs } = req.body

  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  const positionTicks = positionMs * 10000

  await jellyfinService.reportStopped(itemId, positionTicks)
  res.json({ success: true })
})

// Trigger Jellyfin library refresh
router.post('/jellyfin/refresh', async (req: Request, res: Response) => {
  if (!jellyfinService.isEnabled()) {
    res.status(503).json({ error: 'Jellyfin not enabled' })
    return
  }

  await jellyfinService.refreshLibrary()
  res.json({ success: true })
})

// ============================================================================
// PLAYBACK INFO ENDPOINTS (Radarr/Sonarr lookup + Jellyfin streaming)
// ============================================================================

// Get playback info for a movie by TMDB ID
router.get('/movie/:tmdbId', async (req: Request, res: Response) => {
  const tmdbId = parseInt(req.params.tmdbId, 10)
  console.log(`Media API: Getting movie playback for TMDB ID ${tmdbId}`)

  try {
    const playbackInfo = await mediaService.getMoviePlayback(tmdbId)
    if (!playbackInfo) {
      console.log(`Media API: Movie ${tmdbId} not found or no file available`)
      res.json({ found: false })
      return
    }

    console.log(`Media API: Movie ${tmdbId} found, stream URL: ${playbackInfo.streamUrl.substring(0, 80)}...`)
    res.json(playbackInfo)
  } catch (error: any) {
    console.error('Error getting movie playback:', error.message)
    res.status(500).json({ error: 'Failed to get playback info' })
  }
})

// Get playback info for an episode by TMDB show ID, season, and episode
router.get('/episode/:showTmdbId/:season/:episode', async (req: Request, res: Response) => {
  const showTmdbId = parseInt(req.params.showTmdbId, 10)
  const season = parseInt(req.params.season, 10)
  const episode = parseInt(req.params.episode, 10)

  try {
    const playbackInfo = await mediaService.getEpisodePlayback(showTmdbId, season, episode)
    if (!playbackInfo) {
      res.json({ found: false })
      return
    }

    res.json(playbackInfo)
  } catch (error: any) {
    console.error('Error getting episode playback:', error.message)
    res.status(500).json({ error: 'Failed to get playback info' })
  }
})

export default router
