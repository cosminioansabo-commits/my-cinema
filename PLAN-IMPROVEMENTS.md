# My Cinema Improvements Plan

## Overview

This plan addresses the following improvements:
1. Disable torrent download button if media is not in library
2. Consolidate My List and My Library into a single "My Library" concept
3. Track downloaded torrents to prevent duplicate downloads
4. Fix torrent download progress sync issues
5. Add Director page with filmography and bio
6. Add Recommendations section on media detail page
7. Remove plus/play buttons from media cards

---

## 1. Torrent Button - Disable if Not in Library

**Goal:** Users should only be able to download torrents for media that's already added to their Radarr/Sonarr library.

### Changes Required:

**File: `src/views/MediaDetailView.vue`**
- Add a computed property to check if media is in library
- Disable the "Torrent" button when media is not in library
- Show tooltip explaining why button is disabled

```typescript
// Add computed
const isInLibrary = computed(() => {
  if (media.value?.mediaType === 'movie') {
    return libraryMovies.value.some(m => m.tmdbId === media.value?.id)
  } else {
    return librarySeries.value.some(s => /* match by tvdbId or title */)
  }
})
```

**File: `src/components/media/SeasonEpisodes.vue`**
- Same logic for per-episode download buttons
- Disable episode torrent buttons if series not in Sonarr

---

## 2. Consolidate My List and My Library

**Goal:** Remove the separate "My List" (localStorage-based) and keep only "My Library" (Radarr/Sonarr backed).

### Current State:
- **My List:** localStorage-based bookmarks (`listsStore.ts`)
- **My Library:** Radarr/Sonarr integration (`libraryService.ts`)

### Changes Required:

**File: `src/stores/listsStore.ts`**
- Remove or deprecate this store entirely
- OR repurpose it as a "Watchlist" for items user wants but hasn't added to library yet

**File: `src/views/MyListsView.vue`**
- Rename to `MyLibraryView.vue`
- Remove tabs, show only library content
- Keep the current library grid display
- Add "Add to Library" CTA for empty state

**File: `src/views/MediaDetailView.vue`**
- Remove "My List" button
- Keep only "Library" button (rename to "Add to Library" / "In Library")
- Change button behavior:
  - Not in library → "Add to Library" (primary action)
  - In library → "In Library ✓" (shows status, click to remove)

**File: `src/components/media/MediaCard.vue`**
- Change plus button to add to Radarr/Sonarr directly
- Or remove plus button entirely (per requirement #7)

**File: `src/router/index.ts`**
- Update route from `/my-lists` to `/my-library`
- Update navigation labels

**File: `src/components/layout/AppSidebar.vue` & `AppHeader.vue`**
- Update navigation link text from "My Lists" to "My Library"

---

## 3. Track Downloaded Torrents

**Goal:** Prevent users from accidentally downloading the same torrent multiple times.

### Approach A: Use Radarr/Sonarr Status (Recommended)

**Backend Changes (`server/src/`):**
- Radarr API provides `hasFile` field for movies
- Sonarr API provides `episodeFileCount` and `percentOfEpisodes` for series
- Already available in `libraryService.ts`

**Frontend Changes:**

**File: `src/views/MediaDetailView.vue`**
- Check `hasFile` status from Radarr for movies
- Show "Downloaded ✓" indicator instead of torrent button when already downloaded
- For TV: check episode file status from Sonarr

**File: `src/components/media/SeasonEpisodes.vue`**
- Add `hasFile` check per episode
- Show download status icon (✓ downloaded, ↓ downloading, - not downloaded)
- Disable download button for episodes that have files

### Approach B: Track in qBittorrent (Complementary)

**Backend Changes:**
- Query qBittorrent for active/completed downloads
- Match by torrent name or info hash
- Add endpoint: `GET /api/torrents/status/:tmdbId`

**Frontend Changes:**
- Show "Downloading..." status if torrent is in progress
- Prevent duplicate downloads for same media

### Data Flow:
```
User clicks Torrent → Check Radarr/Sonarr hasFile
  → If hasFile: Show "Already Downloaded"
  → If !hasFile: Check qBittorrent active downloads
    → If downloading: Show "Download in Progress"
    → If not: Allow torrent search
```

---

## 4. Fix Torrent Download Progress Sync

**Goal:** Downloads list shows correct real-time status, progress, speed, and ETA.

### Current Issue:
Downloads appear but status/progress shows default values, not synced with actual qBittorrent state.

### Investigation Needed:
- Check WebSocket connection in `torrentsStore.ts`
- Verify backend sends correct `ProgressUpdate` messages
- Check if qBittorrent polling is working in `server/src/`

### Backend Fixes (`server/src/websocket/progressSocket.ts`):

1. Verify qBittorrent API polling interval
2. Ensure progress updates include all fields:
   ```typescript
   {
     downloadId: string,
     progress: number,      // 0-100
     downloadSpeed: number, // bytes/sec
     eta: number,          // seconds
     status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error',
     downloaded: number,   // bytes
     size: number         // bytes
   }
   ```

3. Check qBittorrent torrent matching (by hash or name)

### Frontend Fixes (`src/stores/torrentsStore.ts`):

1. Verify WebSocket message handling
2. Ensure state updates trigger reactivity
3. Add reconnection logic if connection drops

**File: `src/components/torrents/DownloadProgress.vue`**
- Verify computed properties react to store changes
- Add loading state while waiting for initial sync

---

## 5. Director Link on Media Detail

**Goal:** Make director name clickable, linking to existing person/actor page.

### Changes Required:

**File: `src/views/MediaDetailView.vue`**
- Make director name a RouterLink
- Link to existing `/person/:directorId` route (same as actors)

```vue
<!-- Before -->
<span>{{ director.name }}</span>

<!-- After -->
<RouterLink :to="`/person/${director.id}`" class="hover:text-white hover:underline">
  {{ director.name }}
</RouterLink>
```

**Note:** Actor page already exists and handles person details, filmography, etc.

---

## 6. Add Recommendations Section

**Goal:** Show recommended movies/TV shows using TMDB's built-in recommendations.

### Changes:

**File: `src/views/MediaDetailView.vue`**

Add new section after cast:
```vue
<section class="recommendations">
  <h2>More Like This</h2>
  <MediaCarousel :items="recommendations" />
</section>
```

### Implementation:
- TMDB already returns recommendations in `getMediaDetails()` response
- `media.recommendations` contains the data
- Use existing `MediaCarousel` component to display
- Already sorted by relevance from TMDB

---

## 7. Remove Plus/Play Buttons from Media Cards

**Goal:** Simplify media cards by removing action buttons.

### Changes:

**File: `src/components/media/MediaCard.vue`**

Remove:
- Plus button (add to list)
- Play button overlay

Keep:
- Poster image
- Title
- Year
- Rating badge
- Media type badge
- Hover effect (navigate to detail)
- Genres (optional)

### Before:
```vue
<button @click="addToList">+</button>
<button @click="play">▶</button>
```

### After:
- Entire card is clickable
- Click navigates to media detail page
- No overlay buttons

---

## Implementation Order

### Phase 1: Bug Fixes
1. Fix torrent download progress sync (most impactful bug)
2. Track downloaded torrents status (show hasFile from Radarr/Sonarr)

### Phase 2: UI Simplification
3. Remove plus/play buttons from media cards
4. Remove My List completely (delete listsStore, update MyListsView)

### Phase 3: Library-Only Flow
5. Disable torrent button if not in library
6. Rename "My Lists" to "My Library" in navigation

### Phase 4: Enhancements
7. Add Recommendations section on media detail
8. Make director name clickable (link to person page)

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `src/views/MediaDetailView.vue` | Disable torrent btn if not in library, remove My List btn, add recommendations section, make director clickable |
| `src/views/MyListsView.vue` | Remove tabs and My List section, show only library content, rename to MyLibraryView.vue |
| `src/components/media/MediaCard.vue` | Remove plus/play buttons, make entire card clickable |
| `src/components/media/SeasonEpisodes.vue` | Disable torrent if not in library, show hasFile status per episode |
| `src/stores/torrentsStore.ts` | Fix WebSocket sync for real-time progress |
| `src/stores/listsStore.ts` | DELETE this file completely |
| `src/services/libraryService.ts` | Add helpers for hasFile/download status |
| `src/router/index.ts` | Rename /my-lists to /my-library |
| `server/src/websocket/progressSocket.ts` | Fix progress updates from qBittorrent |
| `src/components/layout/AppHeader.vue` | Update nav label "My Lists" → "My Library" |
| `src/components/layout/AppSidebar.vue` | Update nav label "My Lists" → "My Library" |

---

## User Decisions

1. **My List removal:** Remove completely - no localStorage-based lists
2. **Recommendations source:** Use TMDB's built-in recommendations
3. **Director page:** Already have actor page - will reuse/extend for directors
4. **Download tracking:** Show only active downloads
