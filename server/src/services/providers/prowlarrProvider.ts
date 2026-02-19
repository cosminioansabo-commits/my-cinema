import axios from 'axios'
import type { TorrentProvider, TorrentResult, SearchQuery } from '../../types/index.js'
import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'

// Prowlarr API types
interface ProwlarrRelease {
  guid: string
  title: string
  size: number
  indexer: string
  indexerId: number
  downloadUrl?: string
  magnetUrl?: string
  infoHash?: string
  seeders: number
  leechers: number
  protocol: string
  publishDate?: string
  categories?: { id: number; name: string }[]
}

function extractQuality(title: string): string | undefined {
  if (title.includes('2160p') || title.includes('4K') || title.includes('UHD')) return '2160p'
  if (title.includes('1080p')) return '1080p'
  if (title.includes('720p')) return '720p'
  if (title.includes('480p')) return '480p'
  return undefined
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
  return `${(bytes / 1024).toFixed(2)} KB`
}

export const prowlarrProvider: TorrentProvider = {
  name: 'prowlarr',

  async search(query: SearchQuery): Promise<TorrentResult[]> {
    if (!config.prowlarr.enabled) {
      logger.debug('Not configured (missing API key)', 'Prowlarr')
      return []
    }

    try {
      const apiBase = `${config.prowlarr.url}/api/v1`
      const headers = { 'X-Api-Key': config.prowlarr.apiKey }

      // Build search query - for TV shows, don't include year as it's too restrictive
      // For movies, include year to get better matches
      const searchTerm = query.type === 'movie' && query.year
        ? `${query.title} ${query.year}`
        : query.title

      logger.debug(`Searching for "${searchTerm}" (type: ${query.type || 'any'})`, 'Prowlarr')

      // Build params with categories for better results
      // Categories: 2000 = Movies, 5000 = TV
      const params: Record<string, string | number> = {
        query: searchTerm,
        limit: 100
      }

      if (query.type === 'movie') {
        params.categories = 2000
      } else if (query.type === 'tv') {
        params.categories = 5000
      }

      const searchResponse = await axios.get(`${apiBase}/search`, {
        params,
        headers,
        timeout: 30000
      })

      const releases = searchResponse.data as ProwlarrRelease[]

      if (!releases.length) {
        logger.debug('No releases found', 'Prowlarr')
        return []
      }

      const results: TorrentResult[] = []

      for (const release of releases) {
        // Only include torrent releases
        if (release.protocol !== 'torrent') continue

        let magnetLink = release.magnetUrl || ''

        // If we have an info hash but no magnet, construct one
        if (!magnetLink && release.infoHash) {
          const encodedTitle = encodeURIComponent(release.title)
          magnetLink = `magnet:?xt=urn:btih:${release.infoHash}&dn=${encodedTitle}`
        }

        // For private trackers like FileList, use the download URL
        // The download URL from Prowlarr can be used to fetch the .torrent file
        if (!magnetLink && release.downloadUrl) {
          // Use the Prowlarr download URL as the magnet link
          // Our download manager will need to handle this
          magnetLink = release.downloadUrl
        }

        // Skip if no download option available
        if (!magnetLink) continue

        results.push({
          id: `prowlarr-${release.guid}`,
          name: `${release.title} [${release.indexer}]`,
          magnetLink,
          size: formatSize(release.size),
          sizeBytes: release.size,
          seeds: release.seeders || 0,
          peers: release.leechers || 0,
          quality: extractQuality(release.title),
          source: 'prowlarr',
          uploadDate: release.publishDate
        })
      }

      // Sort by seeds
      results.sort((a, b) => b.seeds - a.seeds)

      logger.debug(`Found ${results.length} torrent releases`, 'Prowlarr')
      return results.slice(0, 100)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          console.error('Prowlarr: Connection refused - is Prowlarr running?')
        } else if (error.response?.status === 401) {
          console.error('Prowlarr: Unauthorized - check your API key')
        } else {
          console.error('Prowlarr search error:', error.message)
        }
      } else {
        console.error('Prowlarr search error:', error)
      }
      return []
    }
  }
}
