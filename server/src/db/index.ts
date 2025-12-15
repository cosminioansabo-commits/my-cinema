import Database, { Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Database file location - use data directory for persistence in Docker
const DB_DIR = process.env.DB_PATH || '/data'
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

  console.log('Database initialized:', DB_FILE)
}

// Initialize on import
initSchema()

export default db
export { DB_FILE }
