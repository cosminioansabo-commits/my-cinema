import axios from 'axios'
import type { TorrentProvider, TorrentResult, SearchQuery } from '../../types/index.js'
import { logger } from '../../utils/logger.js'

// Torrentio is a Stremio addon that aggregates torrents from multiple sources
// It requires IMDB ID, but we can search by title using cinemeta first
const CINEMETA_BASE = 'https://v3-cinemeta.strem.io'
const TORRENTIO_BASE = 'https://torrentio.strem.fun'

interface CinemetaResult {
  id: string
  imdb_id?: string
  name: string
  year?: string
  type: string
}

interface TorrentioStream {
  name: string
  title: string
  infoHash: string
  fileIdx?: number
  behaviorHints?: {
    bingeGroup?: string
  }
}

function parseTorrentioName(name: string): { quality?: string; size?: string; source?: string } {
  const quality = name.match(/\b(2160p|4K|1080p|720p|480p)\b/i)?.[0]
  const sizeMatch = name.match(/([\d.]+)\s*(GB|MB)/i)
  const size = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : undefined

  return { quality, size }
}

function extractSeeds(title: string): number {
  // Torrentio includes seeds in the title like "👤 123"
  const match = title.match(/👤\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : 0
}

function createMagnetLink(infoHash: string, name: string): string {
  const encodedName = encodeURIComponent(name)
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://public.popcorn-tracker.org:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://exodus.desync.com:6969',
    'udp://open.demonii.com:1337/announce'
  ]

  const trackersParam = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('')
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodedName}${trackersParam}`
}

async function searchCinemeta(title: string, type: 'movie' | 'series'): Promise<CinemetaResult | null> {
  try {
    const searchUrl = `${CINEMETA_BASE}/catalog/${type}/top/search=${encodeURIComponent(title)}.json`
    const response = await axios.get(searchUrl, { timeout: 10000 })

    if (response.data?.metas?.length > 0) {
      const meta = response.data.metas[0]
      return {
        id: meta.id,
        imdb_id: meta.imdb_id || meta.id,
        name: meta.name,
        year: meta.year,
        type: meta.type
      }
    }
    return null
  } catch (error) {
    console.error('Cinemeta search error:', error)
    return null
  }
}

export const torrentioProvider: TorrentProvider = {
  name: 'torrentio',

  async search(query: SearchQuery): Promise<TorrentResult[]> {
    try {
      // First, find the IMDB ID using Cinemeta
      const mediaType = query.type === 'tv' ? 'series' : 'movie'
      const cinemetaResult = await searchCinemeta(query.title, mediaType)

      if (!cinemetaResult) {
        logger.debug(`No Cinemeta result for "${query.title}"`, 'Torrentio')
        return []
      }

      // Filter by year if provided
      if (query.year && cinemetaResult.year && parseInt(cinemetaResult.year) !== query.year) {
        // Try to find exact match
        logger.debug(`Year mismatch (${cinemetaResult.year} vs ${query.year})`, 'Torrentio')
      }

      const imdbId = cinemetaResult.imdb_id || cinemetaResult.id
      logger.debug(`Found IMDB ID ${imdbId} for "${query.title}"`, 'Torrentio')

      // Now search Torrentio for streams
      // For movies: /stream/movie/{imdbId}.json
      // For series: /stream/series/{imdbId}:{season}:{episode}.json (we'll get all)
      const streamType = query.type === 'tv' ? 'series' : 'movie'
      const streamUrl = `${TORRENTIO_BASE}/stream/${streamType}/${imdbId}.json`

      const response = await axios.get(streamUrl, { timeout: 10000 })

      if (!response.data?.streams?.length) {
        logger.debug(`No streams found for ${imdbId}`, 'Torrentio')
        return []
      }

      const results: TorrentResult[] = []

      for (const stream of response.data.streams as TorrentioStream[]) {
        if (!stream.infoHash) continue

        const { quality, size } = parseTorrentioName(stream.name || '')
        const seeds = extractSeeds(stream.title || '')

        // Parse size to bytes
        let sizeBytes = 0
        if (size) {
          const match = size.match(/([\d.]+)\s*(GB|MB)/i)
          if (match) {
            const value = parseFloat(match[1])
            const unit = match[2].toUpperCase()
            sizeBytes = unit === 'GB' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024
          }
        }

        results.push({
          id: `torrentio-${stream.infoHash}`,
          name: stream.title || stream.name || 'Unknown',
          magnetLink: createMagnetLink(stream.infoHash, cinemetaResult.name),
          size: size || 'Unknown',
          sizeBytes: Math.round(sizeBytes),
          seeds,
          peers: 0, // Torrentio doesn't provide peer count
          quality,
          source: 'torrentio'
        })
      }

      // Sort by seeds
      results.sort((a, b) => b.seeds - a.seeds)

      logger.debug(`Found ${results.length} results`, 'Torrentio')
      return results.slice(0, 20) // Limit results
    } catch (error) {
      console.error('Torrentio search error:', error)
      return []
    }
  }
}
