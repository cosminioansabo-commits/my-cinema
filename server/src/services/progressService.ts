import db from '../db/index.js'

export interface WatchProgress {
  id: number
  userId: string
  mediaType: 'movie' | 'episode'
  tmdbId: number
  seasonNumber: number | null
  episodeNumber: number | null
  positionMs: number
  durationMs: number
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface SaveProgressInput {
  userId: string
  mediaType: 'movie' | 'episode'
  tmdbId: number
  seasonNumber?: number
  episodeNumber?: number
  positionMs: number
  durationMs: number
}

export interface ContinueWatchingItem extends WatchProgress {
  percentComplete: number
}

class ProgressService {
  /**
   * Save or update watch progress
   */
  saveProgress(input: SaveProgressInput): WatchProgress | null {
    const {
      userId,
      mediaType,
      tmdbId,
      seasonNumber = null,
      episodeNumber = null,
      positionMs,
      durationMs
    } = input

    // Determine if completed (>= 95% watched)
    const completed = durationMs > 0 && positionMs / durationMs >= 0.95

    try {
      // SQLite UNIQUE constraint doesn't work with NULL values (NULL != NULL)
      // So we need to handle movies (where season/episode are NULL) differently

      // First, check if record exists
      let existingId: number | null
      if (seasonNumber === null || episodeNumber === null) {
        // For movies: find by user, type, tmdb where season/episode are NULL
        const findStmt = db.prepare(`
          SELECT id FROM watch_progress
          WHERE user_id = ? AND media_type = ? AND tmdb_id = ?
            AND season_number IS NULL AND episode_number IS NULL
        `)
        const existing = findStmt.get(userId, mediaType, tmdbId) as { id: number } | undefined
        existingId = existing?.id ?? null
      } else {
        // For episodes: find by all fields
        const findStmt = db.prepare(`
          SELECT id FROM watch_progress
          WHERE user_id = ? AND media_type = ? AND tmdb_id = ?
            AND season_number = ? AND episode_number = ?
        `)
        const existing = findStmt.get(userId, mediaType, tmdbId, seasonNumber, episodeNumber) as { id: number } | undefined
        existingId = existing?.id ?? null
      }

      let result: any
      if (existingId) {
        // Update existing record
        const updateStmt = db.prepare(`
          UPDATE watch_progress
          SET position_ms = ?, duration_ms = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          RETURNING *
        `)
        result = updateStmt.get(positionMs, durationMs, completed ? 1 : 0, existingId)
      } else {
        // Insert new record
        const insertStmt = db.prepare(`
          INSERT INTO watch_progress (
            user_id, media_type, tmdb_id, season_number, episode_number,
            position_ms, duration_ms, completed, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          RETURNING *
        `)
        result = insertStmt.get(
          userId,
          mediaType,
          tmdbId,
          seasonNumber,
          episodeNumber,
          positionMs,
          durationMs,
          completed ? 1 : 0
        )
      }

      if (result) {
        return this.mapRowToProgress(result)
      }
      return null
    } catch (error) {
      console.error('Error saving progress:', error)
      return null
    }
  }

  /**
   * Get progress for a specific movie
   */
  getMovieProgress(userId: string, tmdbId: number): WatchProgress | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM watch_progress
        WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
      `)

      const result = stmt.get(userId, tmdbId) as any
      if (result) {
        return this.mapRowToProgress(result)
      }
      return null
    } catch (error) {
      console.error('Error getting movie progress:', error)
      return null
    }
  }

  /**
   * Get progress for a specific episode
   */
  getEpisodeProgress(
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number
  ): WatchProgress | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM watch_progress
        WHERE user_id = ?
          AND media_type = 'episode'
          AND tmdb_id = ?
          AND season_number = ?
          AND episode_number = ?
      `)

      const result = stmt.get(userId, tmdbId, seasonNumber, episodeNumber) as any
      if (result) {
        return this.mapRowToProgress(result)
      }
      return null
    } catch (error) {
      console.error('Error getting episode progress:', error)
      return null
    }
  }

  /**
   * Get continue watching list for a user
   * Returns items that are not completed and have progress
   */
  getContinueWatching(userId: string, limit: number = 20): ContinueWatchingItem[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM watch_progress
        WHERE user_id = ?
          AND completed = 0
          AND position_ms > 30000
          AND duration_ms > 0
        ORDER BY updated_at DESC
        LIMIT ?
      `)

      const results = stmt.all(userId, limit) as any[]
      return results.map(row => {
        const progress = this.mapRowToProgress(row)
        return {
          ...progress,
          percentComplete: Math.round((progress.positionMs / progress.durationMs) * 100)
        }
      })
    } catch (error) {
      console.error('Error getting continue watching:', error)
      return []
    }
  }

  /**
   * Mark an item as watched (completed)
   */
  markWatched(
    userId: string,
    mediaType: 'movie' | 'episode',
    tmdbId: number,
    seasonNumber?: number,
    episodeNumber?: number
  ): boolean {
    try {
      let stmt
      if (mediaType === 'movie') {
        stmt = db.prepare(`
          UPDATE watch_progress
          SET completed = 1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
        `)
        stmt.run(userId, tmdbId)
      } else {
        stmt = db.prepare(`
          UPDATE watch_progress
          SET completed = 1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
            AND media_type = 'episode'
            AND tmdb_id = ?
            AND season_number = ?
            AND episode_number = ?
        `)
        stmt.run(userId, tmdbId, seasonNumber, episodeNumber)
      }
      return true
    } catch (error) {
      console.error('Error marking as watched:', error)
      return false
    }
  }

  /**
   * Remove progress entry (mark as unwatched)
   */
  removeProgress(
    userId: string,
    mediaType: 'movie' | 'episode',
    tmdbId: number,
    seasonNumber?: number,
    episodeNumber?: number
  ): boolean {
    try {
      let stmt
      if (mediaType === 'movie') {
        stmt = db.prepare(`
          DELETE FROM watch_progress
          WHERE user_id = ? AND media_type = 'movie' AND tmdb_id = ?
        `)
        stmt.run(userId, tmdbId)
      } else {
        stmt = db.prepare(`
          DELETE FROM watch_progress
          WHERE user_id = ?
            AND media_type = 'episode'
            AND tmdb_id = ?
            AND season_number = ?
            AND episode_number = ?
        `)
        stmt.run(userId, tmdbId, seasonNumber, episodeNumber)
      }
      return true
    } catch (error) {
      console.error('Error removing progress:', error)
      return false
    }
  }

  /**
   * Clear all continue watching progress for a user
   */
  clearAllProgress(userId: string): boolean {
    try {
      const stmt = db.prepare(`DELETE FROM watch_progress WHERE user_id = ?`)
      stmt.run(userId)
      return true
    } catch (error) {
      console.error('Error clearing all progress:', error)
      return false
    }
  }

  /**
   * Get all progress for a TV show (all episodes)
   */
  getShowProgress(userId: string, tmdbId: number): WatchProgress[] {
    try {
      const stmt = db.prepare(`
        SELECT * FROM watch_progress
        WHERE user_id = ?
          AND media_type = 'episode'
          AND tmdb_id = ?
        ORDER BY season_number, episode_number
      `)

      const results = stmt.all(userId, tmdbId) as any[]
      return results.map(row => this.mapRowToProgress(row))
    } catch (error) {
      console.error('Error getting show progress:', error)
      return []
    }
  }

  /**
   * Map database row to WatchProgress object
   */
  private mapRowToProgress(row: any): WatchProgress {
    return {
      id: row.id,
      userId: row.user_id,
      mediaType: row.media_type,
      tmdbId: row.tmdb_id,
      seasonNumber: row.season_number,
      episodeNumber: row.episode_number,
      positionMs: row.position_ms,
      durationMs: row.duration_ms,
      completed: !!row.completed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export const progressService = new ProgressService()
