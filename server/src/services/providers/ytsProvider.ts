import axios from 'axios'
import type { TorrentProvider, TorrentResult, SearchQuery } from '../../types/index.js'

const YTS_API_BASE = 'https://yts.mx/api/v2'

interface YTSMovie {
  id: number
  title: string
  title_long: string
  year: number
  torrents: YTSTorrent[]
}

interface YTSTorrent {
  hash: string
  quality: string
  type: string
  size: string
  size_bytes: number
  seeds: number
  peers: number
  date_uploaded: string
}

function createMagnetLink(hash: string, name: string): string {
  const encodedName = encodeURIComponent(name)
  const trackers = [
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.coppersurfer.tk:6969',
    'udp://glotorrents.pw:6969/announce',
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://torrent.gresille.org:80/announce',
    'udp://p4p.arenabg.com:1337',
    'udp://tracker.leechers-paradise.org:6969'
  ]

  const trackersParam = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('')
  return `magnet:?xt=urn:btih:${hash}&dn=${encodedName}${trackersParam}`
}

function extractCodec(type: string): string | undefined {
  if (type.toLowerCase().includes('web')) return 'WEB'
  if (type.toLowerCase().includes('bluray')) return 'BluRay'
  return undefined
}

export const ytsProvider: TorrentProvider = {
  name: 'yts',

  async search(query: SearchQuery): Promise<TorrentResult[]> {
    // YTS only has movies
    if (query.type === 'tv') {
      return []
    }

    try {
      const params: Record<string, string | number> = {
        query_term: query.title,
        limit: 20
      }

      const response = await axios.get(`${YTS_API_BASE}/list_movies.json`, {
        params,
        timeout: 10000
      })

      const data = response.data

      if (data.status !== 'ok' || !data.data?.movies) {
        return []
      }

      const results: TorrentResult[] = []

      for (const movie of data.data.movies as YTSMovie[]) {
        // Filter by year if provided
        if (query.year && movie.year !== query.year) {
          continue
        }

        for (const torrent of movie.torrents) {
          results.push({
            id: `yts-${movie.id}-${torrent.quality}-${torrent.type}`,
            name: `${movie.title_long} [${torrent.quality}] [${torrent.type}]`,
            magnetLink: createMagnetLink(torrent.hash, movie.title_long),
            size: torrent.size,
            sizeBytes: torrent.size_bytes,
            seeds: torrent.seeds,
            peers: torrent.peers,
            quality: torrent.quality,
            codec: extractCodec(torrent.type),
            source: 'yts',
            uploadDate: torrent.date_uploaded
          })
        }
      }

      return results
    } catch (error) {
      console.error('YTS search error:', error)
      return []
    }
  }
}
