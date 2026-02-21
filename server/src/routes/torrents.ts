import { Router, Request, Response } from 'express'
import { searchTorrents, getProviders } from '../services/torrentSearchService.js'
import { downloadManager } from '../services/downloadManagerService.js'
import type { SearchQuery, DownloadRequest } from '../types/index.js'

const router = Router()

// Search for torrents
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { title, year, type } = req.query

    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required' })
      return
    }

    const query: SearchQuery = {
      title,
      year: year ? parseInt(year as string, 10) : undefined,
      type: type as 'movie' | 'tv' | undefined
    }

    const results = await searchTorrents(query)
    res.json({ results, providers: getProviders() })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
})

// Start a download
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { magnetLink, mediaId, mediaType, name } = req.body as DownloadRequest

    if (!magnetLink) {
      res.status(400).json({ error: 'Magnet link is required' })
      return
    }

    // Validate magnet link format
    if (!magnetLink.startsWith('magnet:?') || !magnetLink.includes('xt=urn:btih:')) {
      res.status(400).json({ error: 'Invalid magnet link format' })
      return
    }

    const download = await downloadManager.startDownload({
      magnetLink,
      mediaId,
      mediaType,
      name
    })

    res.json({ download })
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ error: 'Failed to start download' })
  }
})

// Get all downloads
router.get('/downloads', (req: Request, res: Response) => {
  const downloads = downloadManager.getAllDownloads()
  res.json({ downloads })
})

// Get specific download
router.get('/downloads/:id', (req: Request, res: Response) => {
  const download = downloadManager.getDownload(req.params.id)

  if (!download) {
    res.status(404).json({ error: 'Download not found' })
    return
  }

  res.json({ download })
})

// Pause download
router.put('/downloads/:id/pause', async (req: Request, res: Response) => {
  const success = await downloadManager.pauseDownload(req.params.id)

  if (!success) {
    res.status(400).json({ error: 'Cannot pause download' })
    return
  }

  res.json({ success: true })
})

// Resume download
router.put('/downloads/:id/resume', async (req: Request, res: Response) => {
  const success = await downloadManager.resumeDownload(req.params.id)

  if (!success) {
    res.status(400).json({ error: 'Cannot resume download' })
    return
  }

  res.json({ success: true })
})

// Cancel/remove download
router.delete('/downloads/:id', async (req: Request, res: Response) => {
  const success = await downloadManager.cancelDownload(req.params.id)

  if (!success) {
    res.status(404).json({ error: 'Download not found' })
    return
  }

  res.json({ success: true })
})

export default router
