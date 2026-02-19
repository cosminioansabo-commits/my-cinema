import { Router, Response } from 'express'
import { profileService } from '../services/profileService.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

/**
 * List all profiles
 * GET /api/profiles
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const profiles = profileService.getAll()
    res.json({ profiles })
  } catch (error) {
    console.error('Error fetching profiles:', error)
    res.status(500).json({ error: 'Failed to fetch profiles' })
  }
})

/**
 * Get a single profile
 * GET /api/profiles/:id
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = profileService.getById(req.params.id)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }
    res.json({ profile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

/**
 * Create a new profile
 * POST /api/profiles
 * Body: { name, avatarColor?, avatarIcon? }
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, avatarColor, avatarIcon } = req.body

    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    const profile = profileService.create(name, avatarColor, avatarIcon)
    res.status(201).json({ profile })
  } catch (error: any) {
    if (error.message?.includes('Maximum') || error.message?.includes('must be between')) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Error creating profile:', error)
    res.status(500).json({ error: 'Failed to create profile' })
  }
})

/**
 * Update a profile
 * PUT /api/profiles/:id
 * Body: { name?, avatarColor?, avatarIcon? }
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, avatarColor, avatarIcon } = req.body
    const profile = profileService.update(req.params.id, { name, avatarColor, avatarIcon })

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json({ profile })
  } catch (error: any) {
    if (error.message?.includes('must be between')) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Error updating profile:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

/**
 * Get unique media count for a profile (used for delete warning)
 * GET /api/profiles/:id/unique-media
 */
router.get('/:id/unique-media', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = profileService.getById(req.params.id)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const counts = profileService.getUniqueMediaCount(req.params.id)
    res.json(counts)
  } catch (error) {
    console.error('Error fetching unique media count:', error)
    res.status(500).json({ error: 'Failed to fetch unique media count' })
  }
})

/**
 * Delete a profile
 * DELETE /api/profiles/:id
 *
 * This deletes the profile and all its library entries.
 * Media files are only deleted from disk if no other profile references them.
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Import dynamically to avoid circular dependency
    const { profileLibraryService } = await import('../services/profileLibraryService.js')

    const profile = profileService.getById(req.params.id)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    // Clean up library (handles reference counting and Radarr/Sonarr deletion)
    await profileLibraryService.cleanupProfileLibrary(req.params.id)

    // Delete the profile itself (cascades profile_library, cleans up progress/prefs)
    const result = profileService.delete(req.params.id)
    res.json(result)
  } catch (error: any) {
    if (error.message?.includes('Cannot delete')) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Error deleting profile:', error)
    res.status(500).json({ error: 'Failed to delete profile' })
  }
})

export default router
