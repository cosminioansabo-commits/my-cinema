import db from '../db/index.js'
import { radarrService } from './radarrService.js'
import { sonarrService } from './sonarrService.js'

export interface ProfileLibraryEntry {
  id: number
  profileId: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  radarrId: number | null
  sonarrId: number | null
  tvdbId: number | null
  addedAt: string
}

interface ProfileLibraryRow {
  id: number
  profile_id: string
  media_type: 'movie' | 'tv'
  tmdb_id: number
  title: string
  year: number | null
  poster_path: string | null
  radarr_id: number | null
  sonarr_id: number | null
  tvdb_id: number | null
  added_at: string
}

const toEntry = (row: ProfileLibraryRow): ProfileLibraryEntry => ({
  id: row.id,
  profileId: row.profile_id,
  mediaType: row.media_type,
  tmdbId: row.tmdb_id,
  title: row.title,
  year: row.year,
  posterPath: row.poster_path,
  radarrId: row.radarr_id,
  sonarrId: row.sonarr_id,
  tvdbId: row.tvdb_id,
  addedAt: row.added_at
})

class ProfileLibraryService {
  /**
   * Get all library items for a profile
   */
  getLibrary(profileId: string): ProfileLibraryEntry[] {
    const rows = db.prepare(
      'SELECT * FROM profile_library WHERE profile_id = ? ORDER BY added_at DESC'
    ).all(profileId) as ProfileLibraryRow[]
    return rows.map(toEntry)
  }

  /**
   * Check if media is in a specific profile's library
   */
  isInLibrary(profileId: string, mediaType: string, tmdbId: number): boolean {
    const row = db.prepare(
      'SELECT 1 FROM profile_library WHERE profile_id = ? AND media_type = ? AND tmdb_id = ?'
    ).get(profileId, mediaType, tmdbId)
    return !!row
  }

  /**
   * Check if media is available (downloaded by ANY profile).
   * Queries Radarr/Sonarr to see if the file exists.
   */
  async isAvailable(mediaType: string, tmdbId: number): Promise<{ available: boolean; hasFile: boolean; inLibraryCount: number }> {
    const count = db.prepare(
      'SELECT COUNT(*) as count FROM profile_library WHERE media_type = ? AND tmdb_id = ?'
    ).get(mediaType, tmdbId) as { count: number }

    let hasFile = false

    if (count.count > 0) {
      if (mediaType === 'movie') {
        const movie = await radarrService.getMovieByTmdbId(tmdbId)
        hasFile = movie?.hasFile ?? false
      } else {
        // For TV, get the first profile_library entry to find tvdbId
        const entry = db.prepare(
          'SELECT tvdb_id FROM profile_library WHERE media_type = ? AND tmdb_id = ? LIMIT 1'
        ).get(mediaType, tmdbId) as { tvdb_id: number | null } | undefined
        if (entry?.tvdb_id) {
          const series = await sonarrService.getSeriesByTvdbId(entry.tvdb_id)
          hasFile = (series?.statistics?.episodeFileCount ?? 0) > 0
        }
      }
    }

    return {
      available: count.count > 0,
      hasFile,
      inLibraryCount: count.count
    }
  }

  /**
   * Get reference count for a media item (how many profiles have it)
   */
  getReferenceCount(mediaType: string, tmdbId: number): number {
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM profile_library WHERE media_type = ? AND tmdb_id = ?'
    ).get(mediaType, tmdbId) as { count: number }
    return result.count
  }

  /**
   * Add media to a profile's library.
   * If media is not already in Radarr/Sonarr, adds it there too.
   */
  async addToLibrary(
    profileId: string,
    mediaType: 'movie' | 'tv',
    tmdbId: number,
    title: string,
    year?: number,
    posterPath?: string,
    tvdbId?: number
  ): Promise<{ entry: ProfileLibraryEntry; alreadyDownloaded: boolean }> {
    let radarrId: number | null = null
    let sonarrId: number | null = null
    let alreadyDownloaded = false

    if (mediaType === 'movie') {
      // Check if already in Radarr
      let movie = await radarrService.getMovieByTmdbId(tmdbId)
      if (movie) {
        radarrId = movie.id
        alreadyDownloaded = movie.hasFile
      } else {
        // Add to Radarr
        movie = await radarrService.addMovie({
          tmdbId,
          title,
          year: year || new Date().getFullYear()
        })
        if (movie) radarrId = movie.id
      }
    } else {
      // TV show — need tvdbId for Sonarr
      if (tvdbId) {
        let series = await sonarrService.getSeriesByTvdbId(tvdbId)
        if (series) {
          sonarrId = series.id
          alreadyDownloaded = (series.statistics?.episodeFileCount ?? 0) > 0
        } else {
          series = await sonarrService.addSeries({
            tvdbId,
            title
          })
          if (series) sonarrId = series.id
        }
      } else {
        // Try TMDB lookup through Sonarr
        const series = await sonarrService.lookupSeriesByTmdbId(tmdbId)
        if (series) {
          tvdbId = series.tvdbId
          const existingSeries = await sonarrService.getSeriesByTvdbId(series.tvdbId)
          if (existingSeries) {
            sonarrId = existingSeries.id
            alreadyDownloaded = (existingSeries.statistics?.episodeFileCount ?? 0) > 0
          } else {
            const added = await sonarrService.addSeries({
              tvdbId: series.tvdbId,
              title
            })
            if (added) sonarrId = added.id
          }
        }
      }
    }

    // Insert into profile_library (ignore if duplicate)
    db.prepare(`
      INSERT OR IGNORE INTO profile_library
        (profile_id, media_type, tmdb_id, title, year, poster_path, radarr_id, sonarr_id, tvdb_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(profileId, mediaType, tmdbId, title, year || null, posterPath || null, radarrId, sonarrId, tvdbId || null)

    // If Radarr/Sonarr IDs were obtained, update existing entries that might not have them
    if (radarrId || sonarrId) {
      db.prepare(`
        UPDATE profile_library
        SET radarr_id = COALESCE(radarr_id, ?), sonarr_id = COALESCE(sonarr_id, ?), tvdb_id = COALESCE(tvdb_id, ?)
        WHERE profile_id = ? AND media_type = ? AND tmdb_id = ?
      `).run(radarrId, sonarrId, tvdbId || null, profileId, mediaType, tmdbId)
    }

    const row = db.prepare(
      'SELECT * FROM profile_library WHERE profile_id = ? AND media_type = ? AND tmdb_id = ?'
    ).get(profileId, mediaType, tmdbId) as ProfileLibraryRow

    return { entry: toEntry(row), alreadyDownloaded }
  }

  /**
   * Remove media from a profile's library.
   * Uses reference counting — only deletes from Radarr/Sonarr if no other profile has it.
   */
  async removeFromLibrary(
    profileId: string,
    mediaType: string,
    tmdbId: number
  ): Promise<{ removed: boolean; filesDeleted: boolean }> {
    // Get the entry before deleting (need Radarr/Sonarr IDs)
    const entry = db.prepare(
      'SELECT * FROM profile_library WHERE profile_id = ? AND media_type = ? AND tmdb_id = ?'
    ).get(profileId, mediaType, tmdbId) as ProfileLibraryRow | undefined

    if (!entry) {
      return { removed: false, filesDeleted: false }
    }

    // Use a transaction for atomic reference count check + delete
    const result = db.transaction(() => {
      // Delete the profile_library entry
      db.prepare(
        'DELETE FROM profile_library WHERE profile_id = ? AND media_type = ? AND tmdb_id = ?'
      ).run(profileId, mediaType, tmdbId)

      // Check remaining reference count
      const remaining = db.prepare(
        'SELECT COUNT(*) as count FROM profile_library WHERE media_type = ? AND tmdb_id = ?'
      ).get(mediaType, tmdbId) as { count: number }

      return { remainingCount: remaining.count }
    })()

    let filesDeleted = false

    // If no other profile has this media, delete from Radarr/Sonarr
    if (result.remainingCount === 0) {
      if (mediaType === 'movie' && entry.radarr_id) {
        filesDeleted = await radarrService.deleteMovie(entry.radarr_id, true)
      } else if (mediaType === 'tv' && entry.sonarr_id) {
        filesDeleted = await sonarrService.deleteSeries(entry.sonarr_id, true)
      }
    }

    return { removed: true, filesDeleted }
  }

  /**
   * Clean up all library entries for a profile being deleted.
   * Handles reference counting for each item.
   */
  async cleanupProfileLibrary(profileId: string): Promise<void> {
    const entries = db.prepare(
      'SELECT * FROM profile_library WHERE profile_id = ?'
    ).all(profileId) as ProfileLibraryRow[]

    for (const entry of entries) {
      await this.removeFromLibrary(profileId, entry.media_type, entry.tmdb_id)
    }
  }

  /**
   * Run initial migration: import existing Radarr/Sonarr library into the default profile.
   * Only runs if profile_library is empty.
   */
  async runInitialMigration(): Promise<void> {
    const count = db.prepare('SELECT COUNT(*) as count FROM profile_library').get() as { count: number }
    if (count.count > 0) return

    const defaultProfile = db.prepare("SELECT id FROM profiles WHERE is_default = 1").get() as { id: string } | undefined
    if (!defaultProfile) return

    console.log('Running initial library migration to default profile...')

    // Import movies from Radarr
    try {
      const movies = await radarrService.getMovies()
      for (const movie of movies) {
        db.prepare(`
          INSERT OR IGNORE INTO profile_library
            (profile_id, media_type, tmdb_id, title, year, radarr_id)
          VALUES (?, 'movie', ?, ?, ?, ?)
        `).run(defaultProfile.id, movie.tmdbId, movie.title, movie.year, movie.id)
      }
      console.log(`Migrated ${movies.length} movies to default profile`)
    } catch (error) {
      console.error('Failed to migrate movies from Radarr:', error)
    }

    // Import TV shows from Sonarr
    try {
      const series = await sonarrService.getSeries()
      for (const show of series) {
        db.prepare(`
          INSERT OR IGNORE INTO profile_library
            (profile_id, media_type, tmdb_id, title, year, sonarr_id, tvdb_id)
          VALUES (?, 'tv', ?, ?, ?, ?, ?)
        `).run(defaultProfile.id, 0, show.title, show.year, show.id, show.tvdbId)
        // Note: tmdb_id is 0 for migrated TV shows since Sonarr uses tvdbId.
        // The tvdb_id column is used for Sonarr API calls.
      }
      console.log(`Migrated ${series.length} TV shows to default profile`)
    } catch (error) {
      console.error('Failed to migrate TV shows from Sonarr:', error)
    }
  }
}

export const profileLibraryService = new ProfileLibraryService()
