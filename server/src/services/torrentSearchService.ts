import type { TorrentResult, SearchQuery, TorrentProvider } from '../types/index.js'
import { config } from '../config.js'
import { prowlarrProvider } from './providers/prowlarrProvider.js'
import { torrentioProvider } from './providers/torrentioProvider.js'
import { ytsProvider } from './providers/ytsProvider.js'
import { logger } from '../utils/logger.js'

// Map of available providers
const availableProviders: Record<string, TorrentProvider> = {
  prowlarr: prowlarrProvider,
  torrentio: torrentioProvider,
  yts: ytsProvider
}

// Get enabled providers based on config
function getEnabledProviders(): TorrentProvider[] {
  const enabledNames = config.searchProviders
  const providers: TorrentProvider[] = []

  for (const name of enabledNames) {
    const provider = availableProviders[name.toLowerCase()]
    if (provider) {
      providers.push(provider)
    } else {
      logger.warn(`Unknown provider in config: ${name}`, 'TorrentSearch')
    }
  }

  if (providers.length === 0) {
    logger.warn('No providers configured, using defaults (prowlarr, torrentio)', 'TorrentSearch')
    return [prowlarrProvider, torrentioProvider]
  }

  return providers
}

export async function searchTorrents(query: SearchQuery): Promise<TorrentResult[]> {
  const providers = getEnabledProviders()
  logger.debug(`Searching torrents for: "${query.title}" (year: ${query.year}, type: ${query.type})`, 'TorrentSearch')
  logger.debug(`Using providers: ${providers.map(p => p.name).join(', ')}`, 'TorrentSearch')

  // Search all providers in parallel
  const searchPromises = providers.map(provider =>
    provider.search(query).catch(error => {
      console.error(`Error searching ${provider.name}:`, error)
      return [] as TorrentResult[]
    })
  )

  const results = await Promise.all(searchPromises)

  // Flatten and combine results
  const allResults = results.flat()

  // Sort by seeds (highest first), then by quality
  const qualityOrder: Record<string, number> = {
    '2160p': 4,
    '1080p': 3,
    '720p': 2,
    '480p': 1
  }

  allResults.sort((a, b) => {
    // First sort by seeds
    const seedDiff = b.seeds - a.seeds

    // If seeds are similar (within 20%), sort by quality
    if (Math.abs(seedDiff) < Math.max(a.seeds, b.seeds) * 0.2) {
      const qualityA = qualityOrder[a.quality || ''] || 0
      const qualityB = qualityOrder[b.quality || ''] || 0
      if (qualityB !== qualityA) {
        return qualityB - qualityA
      }
    }

    return seedDiff
  })

  logger.debug(`Found ${allResults.length} results`, 'TorrentSearch')
  return allResults
}

export function getProviders(): string[] {
  return getEnabledProviders().map(p => p.name)
}

export function getAvailableProviders(): string[] {
  return Object.keys(availableProviders)
}
