import { Router, Request, Response } from 'express'
import { progressService } from '../services/progressService.js'

const router = Router()

// Extended request type with user from auth middleware
// Note: This is a single-user system, so we use a default userId
// The auth middleware verifies the token is valid, but doesn't provide a userId
interface AuthRequest extends Request {
  user?: { authenticated: boolean }
}

// Default user ID for single-user system
const DEFAULT_USER_ID = 'default'

/**
 * Save/update watch progress
 * POST /api/progress
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  // Auth middleware already verified the token, use default user
  const userId = DEFAULT_USER_ID

  const { mediaType, tmdbId, seasonNumber, episodeNumber, positionMs, durationMs } = req.body

  if (!mediaType || !tmdbId || positionMs === undefined || durationMs === undefined) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  if (mediaType === 'episode' && (seasonNumber === undefined || episodeNumber === undefined)) {
    res.status(400).json({ error: 'Season and episode numbers required for episodes' })
    return
  }

  const progress = progressService.saveProgress({
    userId,
    mediaType,
    tmdbId,
    seasonNumber,
    episodeNumber,
    positionMs,
    durationMs
  })

  if (progress) {
    res.json(progress)
  } else {
    res.status(500).json({ error: 'Failed to save progress' })
  }
})

/**
 * Get progress for a movie
 * GET /api/progress/movie/:tmdbId
 */
router.get('/movie/:tmdbId', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const tmdbId = parseInt(req.params.tmdbId, 10)
  const progress = progressService.getMovieProgress(userId, tmdbId)

  res.json({ progress: progress || null })
})

/**
 * Get progress for an episode
 * GET /api/progress/episode/:tmdbId/:season/:episode
 */
router.get('/episode/:tmdbId/:season/:episode', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const tmdbId = parseInt(req.params.tmdbId, 10)
  const season = parseInt(req.params.season, 10)
  const episode = parseInt(req.params.episode, 10)

  const progress = progressService.getEpisodeProgress(userId, tmdbId, season, episode)

  res.json({ progress: progress || null })
})

/**
 * Get all progress for a TV show
 * GET /api/progress/show/:tmdbId
 */
router.get('/show/:tmdbId', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const tmdbId = parseInt(req.params.tmdbId, 10)
  const progress = progressService.getShowProgress(userId, tmdbId)

  res.json(progress)
})

/**
 * Get continue watching list
 * GET /api/progress/continue-watching
 */
router.get('/continue-watching', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const limit = parseInt(req.query.limit as string, 10) || 20
  const items = progressService.getContinueWatching(userId, limit)

  res.json({ items })
})

/**
 * Mark as watched
 * POST /api/progress/watched
 */
router.post('/watched', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const { mediaType, tmdbId, seasonNumber, episodeNumber } = req.body

  if (!mediaType || !tmdbId) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const success = progressService.markWatched(
    userId,
    mediaType,
    tmdbId,
    seasonNumber,
    episodeNumber
  )

  if (success) {
    res.json({ success: true })
  } else {
    res.status(500).json({ error: 'Failed to mark as watched' })
  }
})

/**
 * Remove progress (mark as unwatched)
 * DELETE /api/progress/:mediaType/:tmdbId
 */
router.delete('/:mediaType/:tmdbId', async (req: AuthRequest, res: Response) => {
  const userId = DEFAULT_USER_ID

  const mediaType = req.params.mediaType as 'movie' | 'episode'
  const tmdbId = parseInt(req.params.tmdbId, 10)
  const seasonNumber = req.query.season ? parseInt(req.query.season as string, 10) : undefined
  const episodeNumber = req.query.episode ? parseInt(req.query.episode as string, 10) : undefined

  const success = progressService.removeProgress(
    userId,
    mediaType,
    tmdbId,
    seasonNumber,
    episodeNumber
  )

  if (success) {
    res.json({ success: true })
  } else {
    res.status(500).json({ error: 'Failed to remove progress' })
  }
})

export default router
