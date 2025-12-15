# Media Playback Feature Plan

## Overview
Add the ability to play downloaded media files directly in My Cinema, supporting both movies (Radarr) and TV episodes (Sonarr).

## Current State
- File paths are available from Radarr/Sonarr APIs but not exposed to frontend
- No video player component exists
- No streaming/file serving endpoints
- YouTube trailer playback exists (TrailerModal.vue) - can be used as reference
- **Plex Media Server already running on NAS** - can leverage for transcoding!

## Architecture Decision: Plex Integration

### Why Plex?
- Already running on the NAS with media libraries configured
- Handles transcoding automatically (MKV → compatible format)
- Supports direct play when client is compatible
- Hardware acceleration support (if NAS has compatible GPU)
- Works both locally and remotely
- Built-in progress tracking and resume

### How It Works
1. User clicks "Play" in My Cinema
2. Backend matches TMDB ID → Plex `ratingKey` (via Plex's GUID system)
3. Backend generates authenticated stream URL
4. Frontend plays via HTML5 video or HLS.js

---

## Implementation Plan

### Phase 1: Backend - Plex Service

#### 1.1 Create Plex Service
**File**: `server/src/services/plexService.ts`

```typescript
class PlexService {
  private baseUrl: string      // e.g., http://192.168.0.82:32400
  private token: string        // X-Plex-Token
  private clientId: string     // Unique app identifier

  // Core methods
  async getLibraries(): Promise<PlexLibrary[]>
  async findByTmdbId(tmdbId: number, type: 'movie' | 'show'): Promise<PlexMedia | null>
  async findEpisode(showTmdbId: number, season: number, episode: number): Promise<PlexMedia | null>
  async getStreamUrl(ratingKey: string, options?: TranscodeOptions): Promise<string>
  async getPlaybackInfo(ratingKey: string): Promise<PlaybackInfo>
  async updateProgress(ratingKey: string, timeMs: number, state: 'playing' | 'paused' | 'stopped'): Promise<void>
  async getResumePosition(ratingKey: string): Promise<number | null>
}
```

#### 1.2 Add Plex API Routes
**File**: `server/src/routes/playback.ts` (NEW)

```typescript
// Find Plex media by TMDB ID
GET /api/playback/movie/:tmdbId
GET /api/playback/episode/:showTmdbId/:season/:episode
// Returns: { found: boolean, ratingKey?, streamUrl?, resumePosition? }

// Get stream URL (with transcoding options)
GET /api/playback/stream/:ratingKey?quality=1080p&location=lan

// Update playback progress
POST /api/playback/progress
// Body: { ratingKey, timeMs, state, duration }

// Get watch history / continue watching
GET /api/playback/continue-watching
```

#### 1.3 Environment Configuration
**File**: `.env`

```env
# Plex Media Server
PLEX_URL=http://192.168.0.82:32400
PLEX_TOKEN=your-plex-token-here
```

---

### Phase 2: Frontend - Video Player

#### 2.1 Install HLS.js for Adaptive Streaming
```bash
npm install hls.js
```

HLS.js handles Plex's transcoded HLS streams in browsers that don't natively support HLS.

#### 2.2 Create VideoPlayer Component
**File**: `src/components/media/VideoPlayer.vue`

```vue
<script setup lang="ts">
import Hls from 'hls.js'

const props = defineProps<{
  streamUrl: string
  title: string
  resumePosition?: number
}>()

// HLS.js setup for transcoded streams
// Native video for direct play (MP4)
// Controls: play/pause, seek, volume, fullscreen, quality
// Keyboard: space, arrows, f, m, escape
</script>
```

Features:
- Auto-detect direct play vs transcode (HLS)
- Resume prompt if previous position exists
- Fullscreen with custom controls overlay
- Progress reporting every 10 seconds
- Quality indicator

#### 2.3 Create PlaybackModal Component
**File**: `src/components/media/PlaybackModal.vue`

- Full-screen modal wrapper
- Loading state while fetching stream URL
- Error handling (media not found in Plex)
- Close confirmation if playing

---

### Phase 3: Integration

#### 3.1 Add Playback Service
**File**: `src/services/playbackService.ts`

```typescript
export const playbackService = {
  async getMoviePlayback(tmdbId: number): Promise<PlaybackInfo | null>
  async getEpisodePlayback(showTmdbId: number, s: number, e: number): Promise<PlaybackInfo | null>
  async reportProgress(ratingKey: string, timeMs: number, state: string): Promise<void>
  async getContinueWatching(): Promise<ContinueWatchingItem[]>
}
```

#### 3.2 Update MediaDetailView
**File**: `src/views/MediaDetailView.vue`

- Add "Play" button (primary action) when movie is downloaded
- Check Plex availability on mount
- Show resume position if available
- Open PlaybackModal on click

#### 3.3 Update SeasonEpisodes
**File**: `src/components/media/SeasonEpisodes.vue`

- Add play button for each downloaded episode
- Show watch progress bar on episode cards
- Click opens PlaybackModal

---

### Phase 4: Enhanced Features

#### 4.1 Continue Watching Section
**File**: `src/views/HomeView.vue`

- New row: "Continue Watching"
- Shows in-progress media from Plex
- Click resumes playback

#### 4.2 Quality Selection
- Dropdown in player: Original, 1080p, 720p, 480p
- Passed to Plex transcode endpoint
- Remember preference

#### 4.3 Subtitle Selection
- Plex provides subtitle streams
- Dropdown to select language
- Support for burn-in or soft subs

#### 4.4 Audio Track Selection
- Multiple audio tracks (languages, commentary)
- Dropdown in player

---

## File Structure

```
server/src/
├── routes/
│   ├── library.ts          # (existing)
│   └── playback.ts         # NEW - Plex playback routes
├── services/
│   ├── radarrService.ts    # (existing)
│   ├── sonarrService.ts    # (existing)
│   └── plexService.ts      # NEW - Plex API client
└── config.ts               # + Plex config

src/
├── components/
│   └── media/
│       ├── VideoPlayer.vue     # NEW - HLS/native player
│       └── PlaybackModal.vue   # NEW - fullscreen wrapper
├── services/
│   ├── libraryService.ts       # (existing)
│   └── playbackService.ts      # NEW - playback API client
└── views/
    ├── MediaDetailView.vue     # + play button
    └── HomeView.vue            # + continue watching
```

---

## Plex API Reference

### Key Endpoints

```
# Get all libraries
GET /library/sections

# Get library content (movies)
GET /library/sections/{key}/all?type=1

# Get library content (shows)
GET /library/sections/{key}/all?type=2

# Get show seasons
GET /library/metadata/{showRatingKey}/children

# Get season episodes
GET /library/metadata/{seasonRatingKey}/children

# Get media metadata (includes GUID for TMDB matching)
GET /library/metadata/{ratingKey}

# Start transcode session (HLS)
GET /video/:/transcode/universal/start.m3u8?
    path=/library/metadata/{ratingKey}
    &mediaIndex=0
    &partIndex=0
    &protocol=hls
    &directPlay=1
    &directStream=1
    &session={sessionId}
    &X-Plex-Token={token}

# Direct play (no transcode)
GET /library/parts/{partId}/file.mkv?X-Plex-Token={token}

# Report timeline/progress
GET /:/timeline?
    ratingKey={ratingKey}
    &key=/library/metadata/{ratingKey}
    &state=playing
    &time={milliseconds}
    &duration={milliseconds}
```

### Matching TMDB to Plex

Plex stores external IDs in GUID elements:

```xml
<Video ratingKey="12345" title="Movie Title">
  <Guid id="tmdb://12345"/>
  <Guid id="imdb://tt1234567"/>
</Video>
```

Strategy:
1. Cache Plex library on startup (ratingKey → tmdbId mapping)
2. Or query with filter: `GET /library/sections/{key}/all?guid=tmdb://{tmdbId}`

---

## Security

1. **Plex Token**: Store securely, never expose to frontend
2. **Stream URLs**: Backend generates authenticated URLs
3. **JWT Auth**: All playback endpoints require valid JWT
4. **Session IDs**: Unique per playback session

---

## Configuration Required

1. **Plex Token**: Get from Plex.tv account or server XML (owner token for admin access)
2. **Library Keys**: Movie and TV show library section keys
3. **Network**: Ensure backend can reach Plex server

---

## Multi-User / Profile Support

### How Plex Handles Users
- Each Plex Home profile has its own token
- Watch progress is stored **per-user** (not per-account)
- The `X-Plex-Token` in API requests determines whose progress is affected

### Implementation Strategy

**Profile Selection Flow:**
1. User logs into My Cinema (existing JWT auth)
2. Backend fetches available Plex profiles: `GET /library/users`
3. User selects their Plex profile (stored in localStorage/session)
4. All playback requests use that profile's token
5. Progress automatically syncs to the correct Plex profile

**Backend Changes:**
```typescript
// plexService.ts additions
async getAvailableProfiles(): Promise<PlexProfile[]>
async getProfileToken(profileId: number): Promise<string>

// Store active profile per session
activeProfiles: Map<sessionId, plexProfileToken>
```

**API Endpoints:**
```
GET  /api/playback/profiles          # List available Plex profiles
POST /api/playback/profiles/select   # Select active profile for session
GET  /api/playback/profiles/current  # Get current profile
```

**Frontend:**
- Profile selector in header/settings
- Store selected profile in localStorage
- Include profile context in playback requests

### Alternative: Shared Progress (Optional)
If family wants shared "Continue Watching":
- Enable "Shared Watch Status" in Plex server settings
- Or implement custom progress sync in My Cinema database

---

## Estimated Effort

| Phase | Components | Complexity |
|-------|------------|------------|
| Phase 1 | Plex service + routes | Medium |
| Phase 2 | Video player component | Medium |
| Phase 3 | UI integration | Low |
| Phase 4 | Continue watching, quality | Medium |

**MVP**: Phases 1-3 (basic playback working)
