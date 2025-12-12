# Plan: Torrent Scanning & Download Feature

## Overview
Add functionality to scan for torrent sources and download selected films from the My-Cinema application.

## Current State
- Vue 3 + TypeScript frontend application
- Uses TMDB API for movie/TV metadata
- No backend server (all client-side)
- User lists stored in localStorage

## Decisions Made
- **Backend**: Standalone Node.js server with WebTorrent
- **Torrent Sources**: YTS (movies) + 1337x (movies & TV)
- **Streaming**: No streaming while downloading
- **Download Location**: Configured via `.env` file

---

## Implementation Plan

### Phase 1: Backend Setup
- [x] Create `/server` directory structure
- [x] Initialize Node.js project with TypeScript
- [x] Set up Express.js server with CORS
- [x] Configure environment variables (download path, port)
- [x] Set up WebTorrent client

### Phase 2: Torrent Search Providers
- [x] Create YTS provider (official API - movies only)
- [x] Create 1337x provider (web scraper - movies & TV)
- [x] Build search aggregator service
- [x] Normalize results to common format

### Phase 3: Download Management
- [x] Implement download manager with WebTorrent
- [x] Add start/pause/resume/cancel functionality
- [x] Track download progress
- [x] Set up WebSocket for real-time progress updates
- [x] Persist download state (survives server restart)

### Phase 4: REST API Endpoints
- [x] `GET /api/torrents/search` - Search torrents
- [x] `POST /api/torrents/download` - Start download
- [x] `GET /api/torrents/downloads` - List all downloads
- [x] `GET /api/torrents/downloads/:id` - Get download status
- [x] `PUT /api/torrents/downloads/:id/pause` - Pause download
- [x] `PUT /api/torrents/downloads/:id/resume` - Resume download
- [x] `DELETE /api/torrents/downloads/:id` - Cancel/remove download

### Phase 5: Frontend Integration
- [x] Create `torrentService.ts` API client
- [x] Create `torrentsStore.ts` Pinia store
- [x] Add WebSocket connection for progress updates
- [x] Create torrent type definitions

### Phase 6: UI Components
- [x] `TorrentSearchModal.vue` - Search results modal
- [x] `TorrentResultCard.vue` - Individual torrent result
- [x] `DownloadManager.vue` - Sidebar/header download indicator
- [x] `DownloadProgress.vue` - Progress bar component
- [x] `DownloadsView.vue` - Full downloads page
- [x] Add "Find Torrent" button to MediaDetailView
- [x] Add downloads link to navigation (via header icon)

---

## File Structure

### Backend (`/server`)
```
server/
├── .env.example
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Entry point, Express setup
│   ├── config.ts                   # Environment config
│   ├── routes/
│   │   └── torrents.ts             # Torrent API routes
│   ├── services/
│   │   ├── downloadManager.ts      # WebTorrent wrapper
│   │   ├── torrentSearch.ts        # Search aggregator
│   │   └── providers/
│   │       ├── ytsProvider.ts      # YTS API
│   │       └── l337xProvider.ts    # 1337x scraper
│   ├── websocket/
│   │   └── progressSocket.ts       # WebSocket for progress
│   └── types/
│       └── index.ts                # Type definitions
```

### Frontend (additions to `/src`)
```
src/
├── services/
│   └── torrentService.ts           # Backend API client
├── stores/
│   └── torrentsStore.ts            # Download state
├── components/
│   └── torrents/
│       ├── TorrentSearchModal.vue
│       ├── TorrentResultCard.vue
│       ├── DownloadManager.vue
│       └── DownloadProgress.vue
├── views/
│   └── DownloadsView.vue
└── types/
    └── torrent.ts
```

---

## Configuration

### Server `.env`
```env
PORT=3001
DOWNLOAD_PATH=/path/to/downloads
CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env` (addition)
```env
VITE_TORRENT_API_URL=http://localhost:3001
```

---

## API Response Formats

### Search Response
```typescript
interface TorrentResult {
  id: string
  name: string
  magnetLink: string
  size: string           // "1.5 GB"
  sizeBytes: number
  seeds: number
  peers: number
  quality?: string       // "1080p", "720p", "4K"
  codec?: string         // "x264", "x265"
  source: 'yts' | '1337x'
  uploadDate?: string
}
```

### Download Response
```typescript
interface Download {
  id: string
  mediaId?: number
  mediaType?: 'movie' | 'tv'
  name: string
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error'
  progress: number       // 0-100
  downloadSpeed: number  // bytes/sec
  uploadSpeed: number
  size: number
  downloaded: number
  eta?: number           // seconds remaining
  savePath: string
  createdAt: string
  completedAt?: string
  error?: string
}
```

---

## UI/UX Flow

1. User views a movie/TV show in MediaDetailView
2. User clicks **"Find Torrent"** button
3. Modal opens showing search results from YTS + 1337x
   - Sorted by seeds (best quality/availability first)
   - Shows: name, quality, size, seeds, source
4. User clicks download on preferred torrent
5. Download indicator appears in header/sidebar
6. User can click indicator to see progress details
7. User can visit `/downloads` page for full management
8. Completed downloads show file location

---

## Legal Disclaimer
This feature should only be used for downloading content you have the legal right to access. Ensure compliance with local laws regarding torrent usage.
