import { randomUUID } from 'crypto'
import db from '../db/index.js'

export interface Profile {
  id: string
  name: string
  avatarColor: string
  avatarIcon: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface ProfileRow {
  id: string
  name: string
  avatar_color: string
  avatar_icon: string
  is_default: number
  created_at: string
  updated_at: string
}

const MAX_PROFILES = 8

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  avatarColor: row.avatar_color,
  avatarIcon: row.avatar_icon,
  isDefault: row.is_default === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

class ProfileService {
  getAll(): Profile[] {
    const rows = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC').all() as ProfileRow[]
    return rows.map(toProfile)
  }

  getById(id: string): Profile | null {
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined
    return row ? toProfile(row) : null
  }

  create(name: string, avatarColor?: string, avatarIcon?: string): Profile {
    const count = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number }
    if (count.count >= MAX_PROFILES) {
      throw new Error(`Maximum of ${MAX_PROFILES} profiles allowed`)
    }

    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 30) {
      throw new Error('Profile name must be between 1 and 30 characters')
    }

    const id = randomUUID()
    db.prepare(`
      INSERT INTO profiles (id, name, avatar_color, avatar_icon)
      VALUES (?, ?, ?, ?)
    `).run(id, trimmed, avatarColor || '#e50914', avatarIcon || 'pi-user')

    return this.getById(id)!
  }

  update(id: string, data: { name?: string; avatarColor?: string; avatarIcon?: string }): Profile | null {
    const existing = this.getById(id)
    if (!existing) return null

    const name = data.name !== undefined ? data.name.trim() : existing.name
    if (!name || name.length > 30) {
      throw new Error('Profile name must be between 1 and 30 characters')
    }

    db.prepare(`
      UPDATE profiles
      SET name = ?, avatar_color = ?, avatar_icon = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      data.avatarColor || existing.avatarColor,
      data.avatarIcon || existing.avatarIcon,
      id
    )

    return this.getById(id)
  }

  /**
   * Delete a profile and return info about orphaned media.
   * Does NOT delete the actual Radarr/Sonarr media — the caller
   * (profileLibraryService.cleanupProfileLibrary) handles that.
   */
  delete(id: string): { deleted: boolean; orphanedMedia: Array<{ mediaType: string; tmdbId: number; radarrId: number | null; sonarrId: number | null }> } {
    const existing = this.getById(id)
    if (!existing) return { deleted: false, orphanedMedia: [] }

    if (existing.isDefault) {
      throw new Error('Cannot delete the default profile')
    }

    // Find media that only this profile has (reference count = 1)
    const orphaned = db.prepare(`
      SELECT pl.media_type, pl.tmdb_id, pl.radarr_id, pl.sonarr_id
      FROM profile_library pl
      WHERE pl.profile_id = ?
        AND (
          SELECT COUNT(*) FROM profile_library pl2
          WHERE pl2.media_type = pl.media_type AND pl2.tmdb_id = pl.tmdb_id
        ) = 1
    `).all(id) as Array<{ media_type: string; tmdb_id: number; radarr_id: number | null; sonarr_id: number | null }>

    // Delete profile — CASCADE will remove profile_library entries
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id)

    // Clean up watch_progress and user_preferences for this profile
    db.prepare('DELETE FROM watch_progress WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(id)

    return {
      deleted: true,
      orphanedMedia: orphaned.map(o => ({
        mediaType: o.media_type,
        tmdbId: o.tmdb_id,
        radarrId: o.radarr_id,
        sonarrId: o.sonarr_id
      }))
    }
  }

  /**
   * Get the count of media items unique to this profile (not shared with others).
   * Used to warn the user before deletion.
   */
  getUniqueMediaCount(id: string): { movies: number; shows: number } {
    const result = db.prepare(`
      SELECT
        SUM(CASE WHEN pl.media_type = 'movie' THEN 1 ELSE 0 END) as movies,
        SUM(CASE WHEN pl.media_type = 'tv' THEN 1 ELSE 0 END) as shows
      FROM profile_library pl
      WHERE pl.profile_id = ?
        AND (
          SELECT COUNT(*) FROM profile_library pl2
          WHERE pl2.media_type = pl.media_type AND pl2.tmdb_id = pl.tmdb_id
        ) = 1
    `).get(id) as { movies: number | null; shows: number | null } | undefined

    return {
      movies: result?.movies || 0,
      shows: result?.shows || 0
    }
  }
}

export const profileService = new ProfileService()
