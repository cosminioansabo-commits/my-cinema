import axios from 'axios'
import type { TorrentProvider, TorrentResult, SearchQuery } from '../../types/index.js'
import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'

// Radarr API types
interface RadarrRelease {
  guid: string
  quality: {
    quality: {
      name: string
      resolution: number
    }
  }
  title: string
  size: number
  indexer: string
  downloadUrl?: string
  magnetUrl?: string
  infoHash?: string
  seeders: number
  leechers: number
  protocol: string
  publishDate?: string
}

interface RadarrMovie {
  id: number
  title: string
  year: number
  tmdbId: number
  imdbId?: string
}

function extractQuality(qualityName: string, resolution: number): string | undefined {
  if (resolution >= 2160) return '2160p'
  if (resolution >= 1080) return '1080p'
  if (resolution >= 720) return '720p'
  if (resolution >= 480) return '480p'
  return qualityName
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

export const radarrProvider: TorrentProvider = {
  name: 'radarr',

  async search(query: SearchQuery): Promise<TorrentResult[]> {
    // Radarr is only for movies
    if (query.type === 'tv') {
      return []
    }

    if (!config.radarr.enabled) {
      logger.debug('Not configured (missing API key)', 'Radarr')
      return []
    }

    try {
      const apiBase = `${config.radarr.url}/api/v3`
      const headers = { 'X-Api-Key': config.radarr.apiKey }

      // First, search for the movie in Radarr's database or lookup
      logger.debug(`Searching for "${query.title}"`, 'Radarr')

      // Try to find the movie by searching
      const lookupResponse = await axios.get(`${apiBase}/movie/lookup`, {
        params: { term: query.title },
        headers,
        timeout: 10000
      })

      const movies = lookupResponse.data as RadarrMovie[]

      if (!movies.length) {
        logger.debug(`No movie found for "${query.title}"`, 'Radarr')
        return []
      }

      // Find best match by year if provided
      let movie = movies[0]
      if (query.year) {
        const yearMatch = movies.find(m => m.year === query.year)
        if (yearMatch) {
          movie = yearMatch
        }
      }

      logger.debug(`Found movie "${movie.title}" (${movie.year}), TMDB: ${movie.tmdbId}`, 'Radarr')

      // Search for releases using the movie's TMDB ID
      const releasesResponse = await axios.get(`${apiBase}/release`, {
        params: { movieId: movie.id },
        headers,
        timeout: 30000
      }).catch(async () => {
        // If movie isn't in Radarr, try manual search
        logger.debug('Movie not in library, trying manual search...', 'Radarr')
        return axios.get(`${apiBase}/indexer/search`, {
          params: {
            type: 'movie',
            term: `${query.title} ${query.year || ''}`
          },
          headers,
          timeout: 30000
        })
      })

      const releases = releasesResponse.data as RadarrRelease[]

      if (!releases.length) {
        logger.debug('No releases found', 'Radarr')
        return []
      }

      const results: TorrentResult[] = []

      for (const release of releases) {
        // Only include torrent releases with magnet links or info hashes
        if (release.protocol !== 'torrent') continue

        let magnetLink = release.magnetUrl || ''

        // If we have an info hash but no magnet, construct one
        if (!magnetLink && release.infoHash) {
          const encodedTitle = encodeURIComponent(release.title)
          magnetLink = `magnet:?xt=urn:btih:${release.infoHash}&dn=${encodedTitle}`
        }

        // Skip if no magnet link available
        if (!magnetLink) continue

        results.push({
          id: `radarr-${release.guid}`,
          name: release.title,
          magnetLink,
          size: formatSize(release.size),
          sizeBytes: release.size,
          seeds: release.seeders || 0,
          peers: release.leechers || 0,
          quality: extractQuality(release.quality.quality.name, release.quality.quality.resolution),
          source: 'radarr',
          uploadDate: release.publishDate
        })
      }

      // Sort by seeds
      results.sort((a, b) => b.seeds - a.seeds)

      logger.debug(`Found ${results.length} torrent releases`, 'Radarr')
      return results.slice(0, 30)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          console.error('Radarr: Connection refused - is Radarr running?')
        } else if (error.response?.status === 401) {
          console.error('Radarr: Unauthorized - check your API key')
        } else {
          console.error('Radarr search error:', error.message)
        }
      } else {
        console.error('Radarr search error:', error)
      }
      return []
    }
  }
}
