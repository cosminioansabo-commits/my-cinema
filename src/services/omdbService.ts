import axios from 'axios'

const OMDB_BASE_URL = 'https://www.omdbapi.com'

const api = axios.create({
  baseURL: OMDB_BASE_URL,
  params: {
    apikey: import.meta.env.VITE_OMDB_API_KEY,
  },
})

export interface OMDbRating {
  Source: string
  Value: string
}

export interface OMDbResponse {
  Title: string
  Year: string
  Rated: string
  Released: string
  Runtime: string
  Genre: string
  Director: string
  Writer: string
  Actors: string
  Plot: string
  Language: string
  Country: string
  Awards: string
  Poster: string
  Ratings: OMDbRating[]
  Metascore: string
  imdbRating: string
  imdbVotes: string
  imdbID: string
  Type: string
  DVD: string
  BoxOffice: string
  Production: string
  Website: string
  Response: string
  Error?: string
}

export interface ExternalRatings {
  imdb?: { rating: number; votes: string }
  rottenTomatoes?: { rating: number }
  metacritic?: { rating: number }
  awards?: string
}

// Cache to avoid repeated API calls for the same IMDB ID
const ratingsCache = new Map<string, ExternalRatings>()

export async function getExternalRatings(imdbId: string): Promise<ExternalRatings | null> {
  // Check if API key is configured
  if (!import.meta.env.VITE_OMDB_API_KEY) {
    return null
  }

  // Check cache first
  if (ratingsCache.has(imdbId)) {
    return ratingsCache.get(imdbId)!
  }

  try {
    const { data } = await api.get<OMDbResponse>('/', {
      params: { i: imdbId },
    })

    if (data.Response === 'False') {
      return null
    }

    const ratings: ExternalRatings = {}

    // Parse IMDB rating
    if (data.imdbRating && data.imdbRating !== 'N/A') {
      ratings.imdb = {
        rating: parseFloat(data.imdbRating),
        votes: data.imdbVotes || '',
      }
    }

    // Parse Rotten Tomatoes rating
    const rtRating = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')
    if (rtRating) {
      // RT format is "85%" - extract the number
      const rtValue = parseInt(rtRating.Value.replace('%', ''), 10)
      if (!isNaN(rtValue)) {
        ratings.rottenTomatoes = { rating: rtValue }
      }
    }

    // Parse Metacritic rating
    if (data.Metascore && data.Metascore !== 'N/A') {
      const metaValue = parseInt(data.Metascore, 10)
      if (!isNaN(metaValue)) {
        ratings.metacritic = { rating: metaValue }
      }
    }

    // Awards info
    if (data.Awards && data.Awards !== 'N/A') {
      ratings.awards = data.Awards
    }

    // Cache the result
    ratingsCache.set(imdbId, ratings)

    return ratings
  } catch (error) {
    console.error('Error fetching OMDb ratings:', error)
    return null
  }
}

// Check if OMDb API is configured
export function isOMDbConfigured(): boolean {
  return !!import.meta.env.VITE_OMDB_API_KEY
}
