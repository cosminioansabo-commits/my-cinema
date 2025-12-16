# My Cinema - Industry-Standard Streaming Implementation Plan

## Executive Summary

Your current implementation has several issues that cause audio delays, broken seeking, and poor 4K performance. This plan outlines how to achieve Netflix/YouTube-quality streaming by leveraging your UGREEN NAS's Intel QuickSync hardware acceleration.

---

## Current Issues Analysis

### 1. Audio Delay When Changing Speed/Subtitles/Quality

**Root Cause**: `server/src/routes/media.ts:196`
```javascript
'-af', 'aresample=async=1:first_pts=0'
```

The `async=1` filter attempts to resync audio but causes drift, especially:
- After seeking (new FFmpeg process starts with different timing)
- When changing playback speed (browser applies rate change, but FFmpeg output is fixed)
- When selecting subtitles (triggers stream reload)

**Frontend Issue**: `VideoPlayer.vue:411-445` - Seeking destroys and recreates the entire HLS instance, losing audio/video sync state.

### 2. Broken Seeking in Transcoded Streams

**Root Cause**: Real-time transcoding with URL-based seeking

```
User seeks to 1:30:00 →
Frontend builds URL: /transcode/file.mkv?start=5400 →
FFmpeg must decode from start to 5400s (slow!) →
New stream starts, previous buffer lost
```

This is fundamentally broken for long 4K files - FFmpeg can take 30+ seconds to seek.

### 3. 4K Performance Issues

**Root Cause**: No hardware acceleration

Your current FFmpeg command:
```bash
ffmpeg -ss 0 -i input.mkv -c:v copy -c:a aac ...
```

- Uses CPU for audio transcoding (fine)
- BUT: Decoding happens on CPU (slow for HEVC/4K)
- No GPU-accelerated seeking

Your NAS has **Intel QuickSync** (evidenced by `/dev/dri` in Plex) but it's unused!

---

## Architecture Comparison

### Current (Broken)
```
Browser Request → FFmpeg Real-time Transcode → Chunked MP4 → Browser
                       ↓
              CPU decode + encode
              No seeking support
              Audio sync issues
```

### Industry Standard (Netflix/YouTube)
```
Media File → Pre-process Job → HLS Segments + Manifest
                                      ↓
Browser Request → Nginx/Express serves segments → HLS.js plays
                                      ↓
                        Instant start, perfect seeking,
                        Adaptive quality, no CPU load
```

---

## Implementation Plan

## Phase 1: Quick Fixes (1-2 hours)

Fix the immediate issues without major refactoring.

### 1.1 Fix Audio Sync in Transcoding

**File**: `server/src/routes/media.ts`

Replace the FFmpeg transcode command:

```typescript
// BEFORE (broken)
const ffmpegArgs = [
  '-ss', startTime.toString(),
  '-i', filePath,
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-af', 'aresample=async=1:first_pts=0',  // CAUSES SYNC ISSUES
  '-movflags', 'frag_keyframe+empty_moov+faststart',
  '-f', 'mp4',
  'pipe:1'
]

// AFTER (fixed)
const ffmpegArgs = [
  '-ss', startTime.toString(),
  '-i', filePath,
  '-map', '0:v:0',
  '-map', '0:a:0',
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ac', '2',
  '-avoid_negative_ts', 'make_zero',  // Proper timestamp handling
  '-fflags', '+genpts',               // Generate proper timestamps
  '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  '-f', 'mp4',
  'pipe:1'
]
```

### 1.2 Fix Frontend Seeking (Don't Destroy HLS)

**File**: `src/components/media/VideoPlayer.vue`

The current approach destroys HLS on every seek. Instead, for transcoded streams, we should:

```typescript
// BEFORE: Destroys HLS instance on seek
const seekToTranscodePosition = (targetTime: number) => {
  if (hls.value) {
    hls.value.destroy()  // BAD: Loses all state
    hls.value = null
  }
  // ... rebuilds everything
}

// AFTER: Use continuous stream with buffered seeking
// This requires Phase 2's HLS implementation
```

### 1.3 Add Hardware Acceleration Detection

**File**: `server/src/services/mediaService.ts`

```typescript
// Add at top of file
import { execSync } from 'child_process'

// Check for Intel QuickSync
const hasQuickSync = (): boolean => {
  try {
    execSync('ls /dev/dri/renderD128', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export const HW_ACCEL_AVAILABLE = hasQuickSync()
```

---

## Phase 2: HLS with Hardware Transcoding (4-6 hours)

Implement proper HLS streaming with Intel QuickSync.

### 2.1 New HLS Transcoding Endpoint

**File**: `server/src/routes/hls.ts` (new file)

```typescript
import { Router, Request, Response } from 'express'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const router = Router()

// Session storage for active transcodes
const activeSessions = new Map<string, {
  process: ChildProcess
  outputDir: string
  lastAccess: number
}>()

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of activeSessions) {
    if (now - session.lastAccess > 5 * 60 * 1000) {
      session.process.kill()
      fs.rmSync(session.outputDir, { recursive: true, force: true })
      activeSessions.delete(sessionId)
    }
  }
}, 60 * 1000)

// Start HLS transcode session
router.post('/start', async (req: Request, res: Response) => {
  const { filePath, audioTrack = 0, subtitleTrack = null, quality = '1080p' } = req.body

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' })
    return
  }

  // Generate unique session ID
  const sessionId = crypto.randomBytes(16).toString('hex')
  const outputDir = `/tmp/hls-sessions/${sessionId}`
  fs.mkdirSync(outputDir, { recursive: true })

  // Quality presets
  const qualities: Record<string, { width: number; bitrate: string; maxrate: string }> = {
    '2160p': { width: 3840, bitrate: '15M', maxrate: '20M' },
    '1080p': { width: 1920, bitrate: '5M', maxrate: '8M' },
    '720p': { width: 1280, bitrate: '3M', maxrate: '4M' },
    '480p': { width: 854, bitrate: '1.5M', maxrate: '2M' },
  }

  const q = qualities[quality] || qualities['1080p']

  // Build FFmpeg command with Intel QuickSync
  const ffmpegArgs = [
    // Hardware acceleration input
    '-hwaccel', 'qsv',
    '-hwaccel_device', '/dev/dri/renderD128',
    '-hwaccel_output_format', 'qsv',

    // Input file
    '-i', filePath,

    // Video: Hardware transcode with QuickSync
    '-c:v', 'h264_qsv',
    '-preset', 'fast',
    '-look_ahead', '1',
    '-b:v', q.bitrate,
    '-maxrate', q.maxrate,
    '-bufsize', q.maxrate,
    '-vf', `scale_qsv=w=${q.width}:h=-1`,

    // Audio: Transcode to AAC
    '-map', `0:a:${audioTrack}`,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',

    // Subtitles (burn in if selected)
    ...(subtitleTrack !== null ? [
      '-vf', `subtitles='${filePath}':si=${subtitleTrack},scale_qsv=w=${q.width}:h=-1`
    ] : []),

    // HLS output
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '0',
    '-hls_flags', 'delete_segments+independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', `${outputDir}/segment_%04d.ts`,
    `${outputDir}/playlist.m3u8`
  ]

  const ffmpeg = spawn('ffmpeg', ffmpegArgs)

  activeSessions.set(sessionId, {
    process: ffmpeg,
    outputDir,
    lastAccess: Date.now()
  })

  ffmpeg.stderr.on('data', (data) => {
    // Log progress (optional)
    // console.log(`[${sessionId}] ${data.toString()}`)
  })

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.error(`FFmpeg exited with code ${code}`)
    }
  })

  // Wait for initial segments to be ready
  await new Promise<void>((resolve) => {
    const checkReady = setInterval(() => {
      if (fs.existsSync(`${outputDir}/playlist.m3u8`)) {
        clearInterval(checkReady)
        resolve()
      }
    }, 100)
    setTimeout(() => {
      clearInterval(checkReady)
      resolve()
    }, 10000)
  })

  res.json({
    sessionId,
    playlistUrl: `/api/hls/${sessionId}/playlist.m3u8`
  })
})

// Serve HLS playlist
router.get('/:sessionId/playlist.m3u8', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const session = activeSessions.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  session.lastAccess = Date.now()
  const playlistPath = `${session.outputDir}/playlist.m3u8`

  if (!fs.existsSync(playlistPath)) {
    res.status(404).json({ error: 'Playlist not ready' })
    return
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
  res.sendFile(playlistPath)
})

// Serve HLS segments
router.get('/:sessionId/:segment', (req: Request, res: Response) => {
  const { sessionId, segment } = req.params
  const session = activeSessions.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  session.lastAccess = Date.now()
  const segmentPath = `${session.outputDir}/${segment}`

  if (!fs.existsSync(segmentPath)) {
    res.status(404).json({ error: 'Segment not found' })
    return
  }

  res.setHeader('Content-Type', 'video/mp2t')
  res.sendFile(segmentPath)
})

// Seek within session
router.post('/:sessionId/seek', async (req: Request, res: Response) => {
  const { sessionId } = req.params
  const { position } = req.body // in seconds
  const session = activeSessions.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  // Kill current process and restart with seek position
  session.process.kill()

  // Clear old segments
  const files = fs.readdirSync(session.outputDir)
  files.forEach(f => {
    if (f.endsWith('.ts')) {
      fs.unlinkSync(`${session.outputDir}/${f}`)
    }
  })

  // Restart with -ss seek
  // (Similar to start endpoint but with -ss position)
  // ... implementation

  res.json({ success: true })
})

// Stop session
router.delete('/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params
  const session = activeSessions.get(sessionId)

  if (session) {
    session.process.kill()
    fs.rmSync(session.outputDir, { recursive: true, force: true })
    activeSessions.delete(sessionId)
  }

  res.json({ success: true })
})

export default router
```

### 2.2 Update Frontend Video Player

**File**: `src/components/media/VideoPlayer.vue`

Key changes:
1. Use session-based HLS instead of direct transcode URL
2. Maintain HLS instance across seeks
3. Request seek from server instead of rebuilding URL

```typescript
// New approach for transcoded streams
const startHlsSession = async () => {
  const response = await fetch('/api/hls/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: props.filePath,
      quality: selectedQuality.value,
      audioTrack: selectedAudioTrack.value,
      subtitleTrack: selectedSubtitle.value
    })
  })

  const { sessionId, playlistUrl } = await response.json()
  currentSessionId.value = sessionId

  // Initialize HLS with the session playlist
  hls.value = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90,
    maxBufferLength: 60,
  })

  hls.value.loadSource(playlistUrl)
  hls.value.attachMedia(videoRef.value!)
}

// Seek within the session
const seekToPosition = async (targetTime: number) => {
  if (!currentSessionId.value) return

  await fetch(`/api/hls/${currentSessionId.value}/seek`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position: targetTime })
  })

  // HLS.js will automatically recover and continue from new segments
}
```

### 2.3 Docker Configuration for Hardware Acceleration

**IMPORTANT**: Update your `docker-compose.my-cinema.yml` on the NAS to enable Intel QuickSync:

```yaml
services:
  my-cinema-backend:
    image: ghcr.io/${GITHUB_USERNAME}/my-cinema-backend:latest
    container_name: my-cinema-backend
    restart: always
    networks:
      - my-cinema-network
    ports:
      - "3001:3001"
    # ADD THESE FOR QUICKSYNC HARDWARE ACCELERATION
    devices:
      - /dev/dri:/dev/dri    # Intel QuickSync GPU access
    volumes:
      - /volume1/data:/data:ro
      - /tmp/hls-sessions:/tmp/hls-sessions  # HLS segment storage (tmpfs recommended)
    environment:
      - PUID=1000
      - PGID=1000
    env_file:
      - .env
    # Optional: Limit memory for transcoding
    deploy:
      resources:
        limits:
          memory: 4G
```

**Steps to apply on NAS:**
```bash
cd /volume2/docker/my-cinema

# Update docker-compose.my-cinema.yml with the devices section above

# Recreate container with new config
sudo docker compose -f docker-compose.my-cinema.yml down
sudo docker compose -f docker-compose.my-cinema.yml up -d

# Verify GPU access
sudo docker exec my-cinema-backend ls -la /dev/dri/
```

---

## Phase 3: Multi-Quality Adaptive Streaming (Optional, 6-8 hours)

Pre-transcode popular content for instant playback.

### 3.1 Background Transcoding Service

Create a service that:
1. Monitors Radarr/Sonarr for new content
2. Pre-transcodes to multiple qualities (1080p, 720p, 480p)
3. Stores HLS segments on disk
4. Serves pre-transcoded content instantly

**File**: `server/src/services/transcodeQueue.ts`

```typescript
import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

interface TranscodeJob {
  id: string
  filePath: string
  outputDir: string
  qualities: string[]
  status: 'queued' | 'processing' | 'complete' | 'failed'
  progress: number
}

class TranscodeQueue extends EventEmitter {
  private queue: TranscodeJob[] = []
  private processing = false
  private cacheDir = '/volume2/docker/my-cinema/transcode-cache'

  async addToQueue(filePath: string): Promise<string> {
    const id = crypto.randomUUID()
    const outputDir = path.join(this.cacheDir, id)

    const job: TranscodeJob = {
      id,
      filePath,
      outputDir,
      qualities: ['1080p', '720p', '480p'],
      status: 'queued',
      progress: 0
    }

    this.queue.push(job)
    this.processQueue()

    return id
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const job = this.queue.find(j => j.status === 'queued')

    if (!job) {
      this.processing = false
      return
    }

    job.status = 'processing'

    try {
      await this.transcodeToHLS(job)
      job.status = 'complete'
    } catch (error) {
      job.status = 'failed'
      console.error(`Transcode failed: ${error}`)
    }

    this.processing = false
    this.processQueue()
  }

  private async transcodeToHLS(job: TranscodeJob): Promise<void> {
    fs.mkdirSync(job.outputDir, { recursive: true })

    // Create master playlist with multiple qualities
    const masterPlaylist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
    ]

    for (const quality of job.qualities) {
      const qualityDir = path.join(job.outputDir, quality)
      fs.mkdirSync(qualityDir, { recursive: true })

      // Add to master playlist
      const bandwidth = quality === '1080p' ? 5000000 : quality === '720p' ? 3000000 : 1500000
      const resolution = quality === '1080p' ? '1920x1080' : quality === '720p' ? '1280x720' : '854x480'

      masterPlaylist.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}`,
        `${quality}/playlist.m3u8`
      )

      // Transcode this quality
      await this.transcodeQuality(job.filePath, qualityDir, quality)
    }

    // Write master playlist
    fs.writeFileSync(
      path.join(job.outputDir, 'master.m3u8'),
      masterPlaylist.join('\n')
    )
  }

  private transcodeQuality(input: string, outputDir: string, quality: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const qualities = {
        '1080p': { scale: 1920, bitrate: '5M' },
        '720p': { scale: 1280, bitrate: '3M' },
        '480p': { scale: 854, bitrate: '1.5M' },
      }

      const q = qualities[quality as keyof typeof qualities]

      const ffmpeg = spawn('ffmpeg', [
        '-hwaccel', 'qsv',
        '-hwaccel_device', '/dev/dri/renderD128',
        '-i', input,
        '-c:v', 'h264_qsv',
        '-preset', 'slow',  // Better quality for pre-transcoding
        '-b:v', q.bitrate,
        '-vf', `scale_qsv=w=${q.scale}:h=-1`,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '0',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', `${outputDir}/segment_%04d.ts`,
        `${outputDir}/playlist.m3u8`
      ])

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exited with code ${code}`))
      })
    })
  }

  getJobStatus(id: string): TranscodeJob | undefined {
    return this.queue.find(j => j.id === id)
  }

  getCachedContent(filePath: string): string | null {
    // Check if this file has been pre-transcoded
    // Return path to master.m3u8 if exists
    // ... implementation
    return null
  }
}

export const transcodeQueue = new TranscodeQueue()
```

### 3.2 Automatic Pre-Transcoding Hook

Integrate with Radarr/Sonarr webhooks to automatically queue new content:

```typescript
// In server/src/routes/webhooks.ts
router.post('/radarr', async (req, res) => {
  const { eventType, movie } = req.body

  if (eventType === 'Download' && movie?.movieFile?.path) {
    await transcodeQueue.addToQueue(movie.movieFile.path)
  }

  res.json({ success: true })
})
```

---

## Phase 4: Direct Play Optimization (2-3 hours)

For browser-compatible files, skip transcoding entirely.

### 4.1 Enhanced Codec Detection

**File**: `server/src/services/mediaService.ts`

```typescript
// More comprehensive browser compatibility check
const BROWSER_COMPATIBLE = {
  video: ['h264', 'avc1', 'vp9', 'vp8', 'av1'],
  audio: ['aac', 'mp3', 'opus', 'vorbis', 'flac'],
  container: ['mp4', 'webm', 'mov']
}

function canDirectPlay(mediaInfo: MediaInfo): boolean {
  const videoOk = BROWSER_COMPATIBLE.video.some(c =>
    mediaInfo.videoCodec.toLowerCase().includes(c)
  )
  const audioOk = BROWSER_COMPATIBLE.audio.some(c =>
    mediaInfo.audioCodec.toLowerCase().includes(c)
  )
  const containerOk = BROWSER_COMPATIBLE.container.includes(
    mediaInfo.container.toLowerCase()
  )

  return videoOk && audioOk && containerOk
}

function getPlaybackStrategy(mediaInfo: MediaInfo): 'direct' | 'remux' | 'transcode' {
  if (canDirectPlay(mediaInfo)) {
    return 'direct'  // Stream file as-is
  }

  // Video OK but audio needs transcoding (common: MKV with DTS)
  if (BROWSER_COMPATIBLE.video.some(c => mediaInfo.videoCodec.toLowerCase().includes(c))) {
    return 'remux'  // Copy video, transcode audio only
  }

  return 'transcode'  // Full transcode (HEVC on non-Safari, etc.)
}
```

### 4.2 Optimized Direct Stream Endpoint

```typescript
// For direct play, use efficient range request handling
router.get('/direct/:filePath', async (req, res) => {
  // ... existing implementation is good
  // But add:

  // Send file metadata for duration
  res.setHeader('X-Content-Duration', duration)

  // Enable efficient caching
  res.setHeader('Cache-Control', 'public, max-age=3600')
})
```

---

## Implementation Priority

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Phase 1 - Quick Fixes | 1-2 hours | Fixes audio sync issues |
| 2 | Phase 4 - Direct Play | 2-3 hours | Most content plays instantly |
| 3 | Phase 2 - HLS Transcode | 4-6 hours | Proper seeking, hardware accel |
| 4 | Phase 3 - Pre-transcode | 6-8 hours | Netflix-like instant start |

---

## Quick Start Commands

### Test Hardware Acceleration
```bash
# SSH to NAS and run in container
docker exec -it my-cinema-backend bash

# Check QuickSync
ls -la /dev/dri/

# Test FFmpeg with QuickSync
ffmpeg -hwaccel qsv -hwaccel_device /dev/dri/renderD128 \
  -i /data/movies/test.mkv -t 10 \
  -c:v h264_qsv -preset fast \
  -f null -
```

### Verify FFmpeg Capabilities
```bash
ffmpeg -hide_banner -hwaccels
# Should show: qsv

ffmpeg -hide_banner -encoders | grep qsv
# Should show: h264_qsv, hevc_qsv
```

---

## Expected Results After Implementation

| Metric | Current | After Phase 1 | After Phase 2 |
|--------|---------|---------------|---------------|
| Audio sync | Broken | Fixed | Perfect |
| Seek latency | 5-30s | 2-5s | <1s |
| 4K playback | Choppy | Better | Smooth |
| CPU usage | 100% | 60% | <20% |
| Start delay | 3-5s | 2-3s | <1s |

---

## Notes

1. **Intel QuickSync** on your UGREEN NAS can handle 2-3 simultaneous 4K transcodes
2. **Pre-transcoding** trades storage for instant playback (budget ~5GB per movie per quality)
3. **Direct play** should be the goal - most modern content (H.264/AAC/MP4) plays natively
4. **Subtitle burning** via hardware is fast with QuickSync but prevents toggling during playback
