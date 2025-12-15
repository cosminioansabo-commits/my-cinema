# Media Player Enhancements Implementation Plan

## Overview

This plan covers implementing the following features:
1. Subtitle styling (font size, color, background)
2. Playback speed control (0.5x - 2x)
3. Remember playback position with resume
4. Quality selection
5. Next episode auto-play
6. Double-tap to seek (mobile)
7. Buffering indicator on timeline
8. Thumbnail preview on seek
9. Continue watching homepage section

---

## Phase 1: Frontend-Only Features (No Backend Changes)

### 1.1 Playback Speed Control

**Files to modify:**
- `src/components/media/VideoPlayer.vue`

**Implementation:**
```typescript
// Add to player state
const playbackSpeed = ref(1)
const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]

// Add to settings menu
const setPlaybackSpeed = (speed: number) => {
  if (videoRef.value) {
    videoRef.value.playbackRate = speed
    playbackSpeed.value = speed
  }
}
```

**UI Changes:**
- Add "Speed" section to settings dropdown
- Show current speed with options: 0.5x, 0.75x, 1x (Normal), 1.25x, 1.5x, 2x
- Keyboard shortcut: `>` for faster, `<` for slower

**Estimated effort:** 30 minutes

---

### 1.2 Subtitle Styling

**Files to modify:**
- `src/components/media/VideoPlayer.vue`
- `src/composables/useLocalStorage.ts` (already exists)

**Implementation:**

```typescript
// Subtitle settings interface
interface SubtitleSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  fontColor: string
  backgroundColor: string
  backgroundOpacity: number
}

// Default settings
const defaultSubtitleSettings: SubtitleSettings = {
  fontSize: 'medium',
  fontColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.75
}

// Store in localStorage
const subtitleSettings = useLocalStorage('my-cinema-subtitle-settings', defaultSubtitleSettings)
```

**CSS Implementation:**
```css
/* Apply via ::cue pseudo-element */
video::cue {
  font-size: var(--subtitle-font-size);
  color: var(--subtitle-color);
  background-color: var(--subtitle-bg);
}
```

**UI Changes:**
- Add "Subtitles" submenu in settings with:
  - Font Size: Small / Medium / Large / X-Large
  - Font Color: White / Yellow / Green / Cyan (common accessibility colors)
  - Background: Black / Gray / Transparent
  - Background Opacity: 0% / 50% / 75% / 100%

**Estimated effort:** 1-2 hours

---

### 1.3 Double-Tap to Seek (Mobile)

**Files to modify:**
- `src/components/media/VideoPlayer.vue`

**Implementation:**
```typescript
// Touch handling
const lastTapTime = ref(0)
const lastTapSide = ref<'left' | 'right' | null>(null)

const handleTouchStart = (e: TouchEvent) => {
  const now = Date.now()
  const touch = e.touches[0]
  const videoRect = containerRef.value?.getBoundingClientRect()
  if (!videoRect) return

  const tapSide = touch.clientX < videoRect.width / 2 ? 'left' : 'right'

  // Double tap detection (within 300ms)
  if (now - lastTapTime.value < 300 && tapSide === lastTapSide.value) {
    e.preventDefault()
    if (tapSide === 'left') {
      seekRelative(-10)
      showSeekIndicator('left', '-10s')
    } else {
      seekRelative(10)
      showSeekIndicator('right', '+10s')
    }
  }

  lastTapTime.value = now
  lastTapSide.value = tapSide
}
```

**Visual Feedback:**
- Show animated ripple effect on double-tap
- Display "-10s" or "+10s" text briefly
- Similar to YouTube mobile experience

**Estimated effort:** 1 hour

---

### 1.4 Buffering Indicator on Timeline

**Files to modify:**
- `src/components/media/VideoPlayer.vue`

**Implementation:**
```typescript
// Track buffered ranges
const bufferedProgress = ref(0)

// Update on progress event
video.addEventListener('progress', () => {
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1)
    bufferedProgress.value = (bufferedEnd / video.duration) * 100
  }
})
```

**UI Changes:**
- Add gray/lighter bar behind the red progress bar showing buffered amount
- Update on `progress` event from video element

**CSS:**
```css
.progress-bar-container {
  position: relative;
}
.buffered-bar {
  position: absolute;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
}
.progress-bar {
  position: absolute;
  height: 100%;
  background: #e50914;
}
```

**Estimated effort:** 30 minutes

---

## Phase 2: Backend Storage for Progress Tracking

### 2.1 Database Setup

**Files to create:**
- `server/src/db/index.ts` - Database connection
- `server/src/db/schema.ts` - Table definitions
- `server/src/db/migrations/001_initial.sql` - Initial schema

**Technology choice:** SQLite with better-sqlite3 (lightweight, no server needed)

**Schema:**
```sql
-- Watch progress for resuming playback
CREATE TABLE watch_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,           -- From auth token
  media_type TEXT NOT NULL,        -- 'movie' or 'episode'
  tmdb_id INTEGER NOT NULL,        -- TMDB ID of movie or show
  season_number INTEGER,           -- For episodes
  episode_number INTEGER,          -- For episodes
  position_ms INTEGER NOT NULL,    -- Last watched position in milliseconds
  duration_ms INTEGER NOT NULL,    -- Total duration
  completed BOOLEAN DEFAULT FALSE, -- Marked as watched
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, tmdb_id, season_number, episode_number)
);

-- User preferences
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  subtitle_settings TEXT,          -- JSON blob
  default_subtitle_language TEXT,
  default_audio_language TEXT,
  playback_speed REAL DEFAULT 1.0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX idx_progress_user_media ON watch_progress(user_id, media_type, tmdb_id);
CREATE INDEX idx_progress_updated ON watch_progress(updated_at DESC);
```

**Estimated effort:** 2-3 hours

---

### 2.2 Progress API Endpoints

**Files to create/modify:**
- `server/src/routes/progress.ts` - New route file
- `server/src/services/progressService.ts` - Business logic
- `server/src/index.ts` - Register routes

**Endpoints:**

```typescript
// Save/update progress
POST /api/progress
Body: {
  mediaType: 'movie' | 'episode',
  tmdbId: number,
  seasonNumber?: number,
  episodeNumber?: number,
  positionMs: number,
  durationMs: number
}

// Get progress for specific media
GET /api/progress/:mediaType/:tmdbId
GET /api/progress/episode/:tmdbId/:season/:episode

// Get continue watching list
GET /api/progress/continue-watching
Response: {
  items: [{
    mediaType, tmdbId, seasonNumber, episodeNumber,
    positionMs, durationMs, percentComplete,
    updatedAt, mediaDetails (title, poster, etc.)
  }]
}

// Mark as watched/unwatched
POST /api/progress/:mediaType/:tmdbId/watched
DELETE /api/progress/:mediaType/:tmdbId/watched
```

**Estimated effort:** 3-4 hours

---

### 2.3 Frontend Integration for Progress

**Files to modify:**
- `src/services/progressService.ts` - New service
- `src/components/media/PlaybackModal.vue` - Load/save progress
- `src/components/media/VideoPlayer.vue` - Report progress

**Implementation:**

```typescript
// progressService.ts
export const progressService = {
  async saveProgress(data: ProgressData): Promise<void>,
  async getProgress(mediaType, tmdbId, season?, episode?): Promise<Progress | null>,
  async getContinueWatching(): Promise<ContinueWatchingItem[]>,
  async markWatched(mediaType, tmdbId, season?, episode?): Promise<void>
}
```

**PlaybackModal changes:**
```typescript
// On mount, fetch progress
const fetchProgress = async () => {
  const progress = await progressService.getProgress(...)
  if (progress && !progress.completed) {
    resumePosition.value = progress.positionMs
  }
}

// Pass to VideoPlayer
<VideoPlayer :resume-position="resumePosition" />
```

**VideoPlayer changes:**
```typescript
// Debounced progress saving (every 10 seconds)
const saveProgress = useDebounceFn(async () => {
  await progressService.saveProgress({
    mediaType: props.mediaType,
    tmdbId: props.tmdbId,
    positionMs: currentTime.value * 1000,
    durationMs: videoDuration.value * 1000
  })
}, 10000)
```

**Estimated effort:** 2-3 hours

---

## Phase 3: Continue Watching Section

### 3.1 Homepage Integration

**Files to modify:**
- `src/views/HomeView.vue`
- `src/components/media/MediaCarousel.vue` (may need progress indicator)

**Implementation:**

```typescript
// HomeView.vue
const continueWatching = ref<ContinueWatchingItem[]>([])

onMounted(async () => {
  // Load continue watching first (most relevant)
  continueWatching.value = await progressService.getContinueWatching()
  // ... rest of loading
})
```

**UI:**
- New carousel at top of page (after hero, before "My Library")
- Title: "Continue Watching"
- Each card shows:
  - Poster with progress bar overlay at bottom
  - Title (with S01E05 format for episodes)
  - Progress percentage or "X min left"
  - Play button overlay on hover

**Progress Bar on Card:**
```vue
<div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
  <div
    class="h-full bg-red-600"
    :style="{ width: `${item.percentComplete}%` }"
  />
</div>
```

**Estimated effort:** 2-3 hours

---

## Phase 4: Next Episode Auto-Play

### 4.1 Episode Navigation

**Files to modify:**
- `src/components/media/PlaybackModal.vue`
- `src/components/media/VideoPlayer.vue`

**Implementation:**

```typescript
// PlaybackModal.vue
const props = defineProps<{
  // ... existing props
  nextEpisode?: {
    seasonNumber: number
    episodeNumber: number
    title: string
  }
}>()

// Handle video ended
const handleEnded = async () => {
  if (props.mediaType === 'tv' && props.nextEpisode) {
    showNextEpisodePrompt.value = true
    // Auto-play after 10 seconds
    nextEpisodeTimeout = setTimeout(() => {
      playNextEpisode()
    }, 10000)
  } else {
    // Close modal for movies
    isOpen.value = false
  }
}
```

**UI Overlay (Netflix-style):**
```vue
<div v-if="showNextEpisodePrompt" class="next-episode-overlay">
  <div class="next-episode-card">
    <img :src="nextEpisode.thumbnail" />
    <div class="info">
      <span class="label">Next Episode</span>
      <h3>{{ nextEpisode.title }}</h3>
      <p>S{{ nextEpisode.season }}E{{ nextEpisode.episode }}</p>
    </div>
    <div class="countdown">
      <CircularProgress :value="countdown" :max="10" />
      <span>Playing in {{ countdown }}s</span>
    </div>
    <Button @click="playNextEpisode">Play Now</Button>
    <Button @click="cancelAutoPlay" text>Cancel</Button>
  </div>
</div>
```

**Data Flow:**
1. MediaDetailView passes `nextEpisode` info to PlaybackModal
2. When video ends, show overlay with countdown
3. Either auto-play after 10s or user clicks "Play Now"
4. Load next episode's playback info and continue

**Estimated effort:** 3-4 hours

---

## Phase 5: Quality Selection

### 5.1 Backend Transcoding Profiles

**Files to modify:**
- `server/src/routes/media.ts`
- `server/src/services/mediaService.ts`

**Quality profiles:**
```typescript
const QUALITY_PROFILES = {
  'original': { label: 'Original', videoBitrate: null },
  '1080p': { label: '1080p', videoBitrate: '8M', resolution: '1920x1080' },
  '720p': { label: '720p', videoBitrate: '4M', resolution: '1280x720' },
  '480p': { label: '480p', videoBitrate: '2M', resolution: '854x480' },
  '360p': { label: '360p', videoBitrate: '1M', resolution: '640x360' }
}
```

**New endpoint:**
```typescript
GET /api/media/transcode/:filePath?quality=720p&start=0
```

**FFmpeg command for quality transcoding:**
```typescript
const ffmpegArgs = [
  '-ss', startTime,
  '-i', filePath,
  '-c:v', 'libx264',           // Re-encode video
  '-preset', 'veryfast',        // Fast encoding
  '-crf', '23',                 // Quality factor
  '-vf', `scale=${resolution}`, // Resolution scaling
  '-maxrate', videoBitrate,
  '-bufsize', `${parseInt(videoBitrate) * 2}`,
  '-c:a', 'aac',
  '-b:a', '128k',
  '-movflags', 'frag_keyframe+empty_moov',
  '-f', 'mp4',
  'pipe:1'
]
```

**Frontend UI:**
```vue
<!-- In settings menu -->
<div class="quality-section">
  <label>Quality</label>
  <div v-for="quality in availableQualities">
    <button
      :class="{ selected: currentQuality === quality.id }"
      @click="setQuality(quality.id)"
    >
      {{ quality.label }}
      <span v-if="quality.id === 'original'" class="badge">Best</span>
    </button>
  </div>
</div>
```

**Note:** Quality switching requires stream reload (similar to seeking in transcoded streams)

**Estimated effort:** 4-5 hours

---

## Phase 6: Thumbnail Preview on Seek

### 6.1 Backend Thumbnail Generation

**Files to create:**
- `server/src/services/thumbnailService.ts`
- `server/src/routes/thumbnails.ts`

**Implementation approach:**

**Option A: Pre-generate thumbnails (better UX, more storage)**
```typescript
// Generate sprite sheet on first request
// Store as: /thumbnails/{mediaHash}/sprite.jpg
// With VTT file mapping times to sprite positions

GET /api/thumbnails/:mediaHash/sprite.jpg
GET /api/thumbnails/:mediaHash/index.vtt
```

**Option B: On-demand generation (slower, no storage)**
```typescript
GET /api/thumbnails/:filePath?time=120
// Returns single frame at 120 seconds

// FFmpeg command:
ffmpeg -ss 120 -i file.mkv -vframes 1 -vf scale=160:90 -f image2 pipe:1
```

**Recommended: Option A with lazy generation**
- Generate sprite sheet (grid of thumbnails) on first hover
- Cache for subsequent requests
- Each sprite: 160x90px, 10x10 grid = 100 frames
- For 2-hour movie: ~1 thumbnail per 72 seconds

**Frontend implementation:**
```typescript
// On progress bar hover
const handleProgressHover = async (e: MouseEvent) => {
  const percent = (e.offsetX / progressBarWidth) * 100
  const time = (percent / 100) * videoDuration.value

  // Load thumbnail
  thumbnailPreview.value = {
    show: true,
    time,
    x: e.clientX,
    src: getThumbnailUrl(time)
  }
}
```

**Estimated effort:** 6-8 hours (complex feature)

---

## Implementation Priority & Timeline

### Week 1: Quick Wins (Frontend Only)
1. ✅ Playback speed control (30 min)
2. ✅ Buffering indicator (30 min)
3. ✅ Double-tap to seek (1 hour)
4. ✅ Subtitle styling (2 hours)

### Week 2: Backend Foundation
5. ✅ Database setup (3 hours)
6. ✅ Progress API endpoints (4 hours)
7. ✅ Frontend progress integration (3 hours)

### Week 3: Continue Watching & Episodes
8. ✅ Continue watching section (3 hours)
9. ✅ Next episode auto-play (4 hours)

### Week 4: Advanced Features
10. ✅ Quality selection (5 hours)
11. ✅ Thumbnail preview (8 hours)

---

## Dependencies to Install

**Backend:**
```bash
npm install better-sqlite3
npm install @types/better-sqlite3 --save-dev
```

**No additional frontend dependencies needed**

---

## Testing Checklist

### Playback Speed
- [ ] Speed changes immediately
- [ ] Speed persists during session
- [ ] Keyboard shortcuts work
- [ ] Speed resets on new video

### Subtitle Styling
- [ ] Font size changes apply
- [ ] Color changes apply
- [ ] Background opacity works
- [ ] Settings persist in localStorage
- [ ] Works with different subtitle formats

### Progress Tracking
- [ ] Progress saves every 10 seconds
- [ ] Resume position loads correctly
- [ ] Resume prompt appears at correct threshold
- [ ] Progress clears when video completes (>95%)
- [ ] Works for both movies and episodes

### Continue Watching
- [ ] Shows recently watched items
- [ ] Progress bar accurate
- [ ] Clicking item resumes playback
- [ ] Updates when progress changes

### Next Episode
- [ ] Overlay appears at video end
- [ ] Countdown works
- [ ] Cancel button stops auto-play
- [ ] Next episode loads correctly
- [ ] Works at season boundaries

### Quality Selection
- [ ] Quality options show correctly
- [ ] Quality changes with minimal interruption
- [ ] Playback position maintained after quality change
- [ ] "Original" option available

### Thumbnails
- [ ] Thumbnails load on hover
- [ ] Position accurate
- [ ] Performance acceptable
- [ ] Fallback if generation fails
