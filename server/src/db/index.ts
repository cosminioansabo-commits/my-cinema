import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { logger } from '../utils/logger.js'

// Database file location - DB_PATH env var, or /data (Docker), or ./data (local dev)
function resolveDbDir(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH
  // In Docker, /data is mounted as a volume
  try {
    fs.accessSync('/data', fs.constants.W_OK)
    return '/data'
  } catch {
    return './data'
  }
}
const DB_DIR = resolveDbDir()
const DB_FILE = path.join(DB_DIR, 'my-cinema.db')

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Create database connection
const db: DatabaseType = new Database(DB_FILE)

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Initialize schema
const initSchema = () => {
  // Watch progress table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'episode')),
      tmdb_id INTEGER NOT NULL,
      season_number INTEGER,
      episode_number INTEGER,
      position_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, media_type, tmdb_id, season_number, episode_number)
    )
  `)

  // User preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      subtitle_settings TEXT,
      default_subtitle_language TEXT,
      default_audio_language TEXT,
      playback_speed REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Profiles table — multi-user profile system
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#e50914',
      avatar_icon TEXT NOT NULL DEFAULT 'pi-user',
      is_default BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Per-profile library — associates profiles with media in Radarr/Sonarr
  // Reference counting: media files are only deleted when no profile references them
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
      tmdb_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      poster_path TEXT,
      radarr_id INTEGER,
      sonarr_id INTEGER,
      tvdb_id INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, media_type, tmdb_id),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `)

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_progress_user_media
    ON watch_progress(user_id, media_type, tmdb_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_progress_updated
    ON watch_progress(updated_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_progress_user_updated
    ON watch_progress(user_id, updated_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profile_library_profile
    ON profile_library(profile_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profile_library_media
    ON profile_library(media_type, tmdb_id)
  `)

  // Migration: create default profile if none exists
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number }
  if (profileCount.count === 0) {
    db.prepare(`
      INSERT INTO profiles (id, name, avatar_color, avatar_icon, is_default)
      VALUES ('default', 'Default', '#e50914', 'pi-user', 1)
    `).run()
    logger.info('Created default profile', 'Database')
  }

  logger.info(`Database initialized: ${DB_FILE}`, 'Database')
}

// Initialize on import
initSchema()

export default db
export { DB_FILE }
