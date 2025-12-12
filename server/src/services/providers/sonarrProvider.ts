import axios from 'axios'
import type { TorrentProvider, TorrentResult, SearchQuery } from '../../types/index.js'
import { config } from '../../config.js'

// Sonarr API types
interface SonarrRelease {
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
  seasonNumber?: number
  episodeNumbers?: number[]
  fullSeason?: boolean
}

interface SonarrSeries {
  id: number
  title: string
  year: number
  tvdbId: number
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

export const sonarrProvider: TorrentProvider = {
  name: 'sonarr',

  async search(query: SearchQuery): Promise<TorrentResult[]> {
    // Sonarr is only for TV shows
    if (query.type !== 'tv') {
      return []
    }

    if (!config.sonarr.enabled) {
      console.log('Sonarr: Not configured (missing API key)')
      return []
    }

    try {
      const apiBase = `${config.sonarr.url}/api/v3`
      const headers = { 'X-Api-Key': config.sonarr.apiKey }

      // First, search for the series in Sonarr's database or lookup
      console.log(`Sonarr: Searching for "${query.title}"`)

      // Try to find the series by searching
      const lookupResponse = await axios.get(`${apiBase}/series/lookup`, {
        params: { term: query.title },
        headers,
        timeout: 10000
      })

      const series = lookupResponse.data as SonarrSeries[]

      if (!series.length) {
        console.log(`Sonarr: No series found for "${query.title}"`)
        return []
      }

      // Find best match by year if provided
      let show = series[0]
      if (query.year) {
        const yearMatch = series.find(s => s.year === query.year)
        if (yearMatch) {
          show = yearMatch
        }
      }

      console.log(`Sonarr: Found series "${show.title}" (${show.year}), TVDB: ${show.tvdbId}`)

      // Search for releases using the series' ID
      const releasesResponse = await axios.get(`${apiBase}/release`, {
        params: { seriesId: show.id },
        headers,
        timeout: 30000
      }).catch(async () => {
        // If series isn't in Sonarr, try manual search
        console.log('Sonarr: Series not in library, trying manual search...')
        return axios.get(`${apiBase}/indexer/search`, {
          params: {
            type: 'series',
            term: `${query.title} ${query.year || ''}`
          },
          headers,
          timeout: 30000
        })
      })

      const releases = releasesResponse.data as SonarrRelease[]

      if (!releases.length) {
        console.log('Sonarr: No releases found')
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

        // Add season/episode info to the name if available
        let name = release.title
        if (release.fullSeason && release.seasonNumber !== undefined) {
          name = `${name} (Full Season ${release.seasonNumber})`
        }

        results.push({
          id: `sonarr-${release.guid}`,
          name,
          magnetLink,
          size: formatSize(release.size),
          sizeBytes: release.size,
          seeds: release.seeders || 0,
          peers: release.leechers || 0,
          quality: extractQuality(release.quality.quality.name, release.quality.quality.resolution),
          source: 'sonarr',
          uploadDate: release.publishDate
        })
      }

      // Sort by seeds
      results.sort((a, b) => b.seeds - a.seeds)

      console.log(`Sonarr: Found ${results.length} torrent releases`)
      return results.slice(0, 30)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          console.error('Sonarr: Connection refused - is Sonarr running?')
        } else if (error.response?.status === 401) {
          console.error('Sonarr: Unauthorized - check your API key')
        } else {
          console.error('Sonarr search error:', error.message)
        }
      } else {
        console.error('Sonarr search error:', error)
      }
      return []
    }
  }
}
