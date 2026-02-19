import { Router, Response } from 'express'
import { profileLibraryService } from '../services/profileLibraryService.js'
import { profileService } from '../services/profileService.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

/**
 * Get library for a profile
 * GET /api/profiles/:profileId/library
 */
router.get('/:profileId/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = profileService.getById(req.params.profileId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const library = profileLibraryService.getLibrary(req.params.profileId)
    res.json({ library })
  } catch (error) {
    console.error('Error fetching profile library:', error)
    res.status(500).json({ error: 'Failed to fetch library' })
  }
})

/**
 * Add media to a profile's library
 * POST /api/profiles/:profileId/library
 * Body: { mediaType, tmdbId, title, year?, posterPath?, tvdbId? }
 */
router.post('/:profileId/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = profileService.getById(req.params.profileId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const { mediaType, tmdbId, title, year, posterPath, tvdbId } = req.body

    if (!mediaType || !tmdbId || !title) {
      res.status(400).json({ error: 'mediaType, tmdbId, and title are required' })
      return
    }

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      res.status(400).json({ error: 'mediaType must be "movie" or "tv"' })
      return
    }

    const result = await profileLibraryService.addToLibrary(
      req.params.profileId,
      mediaType,
      tmdbId,
      title,
      year,
      posterPath,
      tvdbId
    )

    res.status(201).json(result)
  } catch (error) {
    console.error('Error adding to profile library:', error)
    res.status(500).json({ error: 'Failed to add to library' })
  }
})

/**
 * Remove media from a profile's library
 * DELETE /api/profiles/:profileId/library/:mediaType/:tmdbId
 */
router.delete('/:profileId/library/:mediaType/:tmdbId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = profileService.getById(req.params.profileId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const { mediaType, tmdbId } = req.params
    const result = await profileLibraryService.removeFromLibrary(
      req.params.profileId,
      mediaType,
      parseInt(tmdbId, 10)
    )

    res.json(result)
  } catch (error) {
    console.error('Error removing from profile library:', error)
    res.status(500).json({ error: 'Failed to remove from library' })
  }
})

/**
 * Check if media is in a profile's library
 * GET /api/profiles/:profileId/library/check/:mediaType/:tmdbId
 */
router.get('/:profileId/library/check/:mediaType/:tmdbId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { profileId, mediaType, tmdbId } = req.params
    const inLibrary = profileLibraryService.isInLibrary(profileId, mediaType, parseInt(tmdbId, 10))
    res.json({ inLibrary })
  } catch (error) {
    console.error('Error checking library:', error)
    res.status(500).json({ error: 'Failed to check library' })
  }
})

/**
 * Check if media is available (downloaded by any profile)
 * GET /api/library/available/:mediaType/:tmdbId
 *
 * Note: this route is mounted under /api/profiles but accessible globally
 */
router.get('/library/available/:mediaType/:tmdbId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mediaType, tmdbId } = req.params
    const availability = await profileLibraryService.isAvailable(mediaType, parseInt(tmdbId, 10))
    res.json(availability)
  } catch (error) {
    console.error('Error checking availability:', error)
    res.status(500).json({ error: 'Failed to check availability' })
  }
})

export default router
