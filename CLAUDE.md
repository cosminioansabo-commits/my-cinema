# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Environment Variables

Required in `.env`:
- `VITE_TMDB_API_KEY` - The Movie Database API key
- `VITE_TORRENT_API_URL` - Backend torrent/library API URL (default: http://localhost:3001)
- `VITE_OMDB_API_KEY` - OMDB API key (for additional movie data)

## Architecture Overview

This is a Vue 3 media browsing application (Netflix-style) with torrent download capabilities.

### Tech Stack
- **Vue 3** with Composition API (`<script setup>`)
- **Pinia** for state management
- **Vue Router** with authentication guards
- **PrimeVue** (Aura theme) + **Tailwind CSS v4** for UI
- **Axios** for HTTP requests
- **TypeScript** with strict mode

### Key Architectural Patterns

**Services Layer** (`src/services/`):
- `tmdbService.ts` - TMDB API integration for movie/TV metadata. All API responses are transformed from snake_case to camelCase internally.
- `torrentService.ts` - Backend API for torrent search/download with WebSocket for real-time progress updates
- `libraryService.ts` - Radarr/Sonarr integration for media library management
- `omdbService.ts` - OMDB API for additional movie details

**State Management** (`src/stores/`):
- `mediaStore` - Trending, search, browse results, and current media details
- `torrentsStore` - Download queue and WebSocket connection management
- `filtersStore` - Browse page filter state (genres, year, rating, platforms)
- `authStore` - Authentication state with token management

**Composables** (`src/composables/`):
- `useAuthInterceptor` - Axios interceptor for adding auth tokens to API requests
- `useLocalStorage` - Reactive localStorage wrapper
- `useDebounce` - Debounce utility for search inputs

### Type System

Core types in `src/types/index.ts`:
- `Media` / `MediaDetails` - Base and detailed media info
- `MediaType` = 'movie' | 'tv'
- `Season`, `Episode`, `SeasonDetails` - TV show structures
- `FilterOptions` - Browse page filtering

Torrent types in `src/types/torrent.ts` for download management.

### Path Alias

Use `@/` alias for imports from `src/` (configured in both vite.config.ts and tsconfig.json).
