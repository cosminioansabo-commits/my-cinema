import { Router, Request, Response } from 'express'
import { plexService } from '../services/plexService.js'

const router = Router()

// Check Plex connection status
router.get('/status', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.json({ enabled: false, connected: false })
    return
  }

  const connected = await plexService.testConnection()
  res.json({ enabled: true, connected })
})

// Get available libraries
router.get('/libraries', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const libraries = await plexService.getLibraries()
  res.json({ libraries })
})

// Get playback info for a movie by TMDB ID
router.get('/movie/:tmdbId', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const tmdbId = parseInt(req.params.tmdbId, 10)
  const quality = req.query.quality as string | undefined

  const movie = await plexService.findByTmdbId(tmdbId, 'movie')
  if (!movie) {
    res.json({ found: false })
    return
  }

  const playbackInfo = await plexService.getPlaybackInfo(movie.ratingKey, { quality })
  if (!playbackInfo) {
    res.json({ found: false })
    return
  }

  res.json({
    found: true,
    ...playbackInfo
  })
})

// Get playback info for a TV episode by TMDB show ID, season, and episode
router.get('/episode/:showTmdbId/:season/:episode', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const showTmdbId = parseInt(req.params.showTmdbId, 10)
  const season = parseInt(req.params.season, 10)
  const episode = parseInt(req.params.episode, 10)
  const quality = req.query.quality as string | undefined

  const episodeData = await plexService.findEpisode(showTmdbId, season, episode)
  if (!episodeData) {
    res.json({ found: false })
    return
  }

  const playbackInfo = await plexService.getPlaybackInfo(episodeData.ratingKey, { quality })
  if (!playbackInfo) {
    res.json({ found: false })
    return
  }

  res.json({
    found: true,
    ...playbackInfo
  })
})

// Get stream URL by Plex rating key (for direct access)
router.get('/stream/:ratingKey', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const { ratingKey } = req.params
  const quality = req.query.quality as string | undefined
  const location = req.query.location as 'lan' | 'wan' | undefined

  const playbackInfo = await plexService.getPlaybackInfo(ratingKey, { quality })
  if (!playbackInfo) {
    res.status(404).json({ error: 'Media not found' })
    return
  }

  // Regenerate stream URL with requested options
  const streamUrl = plexService.getStreamUrl(ratingKey, { quality, location })

  res.json({
    ...playbackInfo,
    streamUrl
  })
})

// Update playback progress
router.post('/progress', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const { ratingKey, timeMs, state, duration } = req.body

  if (!ratingKey || timeMs === undefined || !state) {
    res.status(400).json({ error: 'Missing required fields: ratingKey, timeMs, state' })
    return
  }

  await plexService.updateProgress(ratingKey, timeMs, state, duration)
  res.json({ success: true })
})

// Mark as watched
router.post('/watched/:ratingKey', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  await plexService.markAsWatched(req.params.ratingKey)
  res.json({ success: true })
})

// Mark as unwatched
router.delete('/watched/:ratingKey', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  await plexService.markAsUnwatched(req.params.ratingKey)
  res.json({ success: true })
})

// Get continue watching (on deck)
router.get('/continue-watching', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const items = await plexService.getContinueWatching()

  // Transform to include stream URLs
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const playbackInfo = await plexService.getPlaybackInfo(item.ratingKey)
      return {
        ratingKey: item.ratingKey,
        title: item.grandparentTitle
          ? `${item.grandparentTitle} - S${item.parentIndex}E${item.index}`
          : item.title,
        fullTitle: item.grandparentTitle
          ? `${item.grandparentTitle} - S${item.parentIndex}E${item.index} - ${item.title}`
          : item.title,
        type: item.type,
        thumb: item.thumb ? `${process.env.PLEX_URL}${item.thumb}?X-Plex-Token=${process.env.PLEX_TOKEN}` : null,
        duration: item.duration,
        viewOffset: item.viewOffset || 0,
        progress: item.viewOffset && item.duration
          ? Math.round((item.viewOffset / item.duration) * 100)
          : 0,
        streamUrl: playbackInfo?.streamUrl
      }
    })
  )

  res.json({ items: enrichedItems })
})

// Get recently added
router.get('/recently-added', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const limit = parseInt(req.query.limit as string) || 20
  const items = await plexService.getRecentlyAdded(limit)

  res.json({ items })
})

// Get available profiles (for multi-user support)
router.get('/profiles', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  const profiles = await plexService.getProfiles()
  res.json({ profiles })
})

// Invalidate library cache (useful after adding new media)
router.post('/refresh-cache', async (req: Request, res: Response) => {
  if (!plexService.isEnabled()) {
    res.status(503).json({ error: 'Plex is not configured' })
    return
  }

  plexService.invalidateCache()
  res.json({ success: true, message: 'Cache invalidated' })
})

export default router
