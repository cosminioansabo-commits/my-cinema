# My Cinema

A Netflix-style media browsing application built with Vue 3 for discovering, downloading, and streaming movies and TV shows.

## Features

- Browse trending movies and TV shows via TMDB
- Search and download torrents via Prowlarr + qBittorrent
- Media library management with Radarr (movies) and Sonarr (TV)
- Video playback with Jellyfin HLS transcoding
- Real-time download progress via WebSocket
- Watch progress tracking
- Rotten Tomatoes and Metacritic scores via OMDB
- PWA support for mobile devices

## Tech Stack

**Frontend:**
- Vue 3 with Composition API
- Pinia for state management
- Vue Router with authentication guards
- PrimeVue (Aura theme) + Tailwind CSS v4
- TypeScript with strict mode
- Vite

**Backend:**
- Express.js with TypeScript
- WebSocket for real-time updates
- SQLite for watch progress
- JWT authentication

## Prerequisites

- Node.js ^20.19.0 or >=22.12.0
- Docker (for deployment)
- API keys for TMDB, OMDB
- Running instances of: Jellyfin, Radarr, Sonarr, Prowlarr, qBittorrent

## Installation

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

## Environment Variables

Create `.env` in the project root:

```env
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_TORRENT_API_URL=http://localhost:3001
VITE_OMDB_API_KEY=your_omdb_api_key
```

Create `server/.env`:

```env
JWT_SECRET=your_random_secret_32_chars_minimum
APP_PASSWORD_HASH=bcrypt_hash_of_password

JELLYFIN_URL=http://jellyfin:8096
JELLYFIN_EXTERNAL_URL=http://localhost:8096
JELLYFIN_API_KEY=your_jellyfin_api_key

RADARR_URL=http://radarr:7878
RADARR_API_KEY=your_radarr_api_key

SONARR_URL=http://sonarr:8989
SONARR_API_KEY=your_sonarr_api_key

PROWLARR_URL=http://prowlarr:9696
PROWLARR_API_KEY=your_prowlarr_api_key

QBITTORRENT_URL=http://qbittorrent:8080
QBITTORRENT_USERNAME=admin
QBITTORRENT_PASSWORD=adminadmin
```

## Build & Deployment

### Production Build

```bash
npm run build
npm run preview
```

### Docker

```bash
docker compose -f docker-compose.my-cinema.yml up -d
```

## Project Structure

```
my-cinema/
├── src/
│   ├── components/     # Vue components
│   ├── composables/    # Vue composables
│   ├── services/       # API services (TMDB, torrents, library, media)
│   ├── stores/         # Pinia stores
│   ├── types/          # TypeScript types
│   └── views/          # Page components
├── server/
│   └── src/
│       ├── routes/     # Express route handlers
│       ├── services/   # Business logic
│       ├── middleware/ # Auth middleware
│       └── websocket/  # WebSocket server
└── public/             # Static assets
```

## License

Private
