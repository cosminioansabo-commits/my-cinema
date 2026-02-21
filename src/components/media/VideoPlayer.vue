<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import Hls from 'hls.js'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { mediaService } from '@/services/mediaService'
import { subtitleService, type SubtitleSearchResult, type SubtitleLanguage } from '@/services/subtitleService'
import { formatTime } from '@/utils/formatters'
import { useSubtitleStyle, fontSizeOptions, fontColorOptions, bgOpacityOptions } from '@/composables/useSubtitleStyle'
import { useLanguage } from '@/composables/useLanguage'
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/config/keyboardShortcuts'
import { useTouchGestures } from '@/composables/useTouchGestures'

interface SubtitleTrack {
  id: number
  language: string
  languageCode: string
  displayTitle: string
  url?: string
}

interface AudioTrack {
  id: number
  streamIndex: number
  language: string
  languageCode: string
  displayTitle: string
  selected: boolean
}

const props = defineProps<{
  streamUrl: string
  title: string
  resumePosition?: number // in milliseconds
  duration?: number // in milliseconds
  subtitles?: SubtitleTrack[]
  audioTracks?: AudioTrack[]
  filePath?: string
  onProgress?: (timeMs: number, state: 'playing' | 'paused' | 'stopped') => void
  // Jellyfin fields
  jellyfinItemId?: string
  jellyfinMediaSourceId?: string
  jellyfinPlaySessionId?: string
  // Media info for subtitle search
  tmdbId?: number
  mediaType?: 'movie' | 'tv'
  seasonNumber?: number
  episodeNumber?: number
}>()

const emit = defineEmits<{
  close: []
  ended: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const hls = ref<Hls | null>(null)

// Player state
const isPlaying = ref(false)
const currentTime = ref(0)
const videoDuration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)
const showControls = ref(true)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const showResumePrompt = ref(false)
const showSettings = ref(false)
const settingsTab = ref<'main' | 'subtitleStyle' | 'subtitleSearch'>('main')
const hasReportedStarted = ref(false)

// Subtitle search state
const subtitleSearchEnabled = ref(false)
const subtitleLanguages = ref<SubtitleLanguage[]>([])
const selectedSearchLanguage = ref('ro')
const subtitleSearchResults = ref<SubtitleSearchResult[]>([])
const isSearchingSubtitles = ref(false)
const isDownloadingSubtitle = ref(false)
const subtitleSearchError = ref('')

// Subtitle state
const selectedSubtitle = ref<number | null>(null)

// Buffering state
const bufferedProgress = ref(0)

// Audio track state
const selectedAudioTrack = ref<number>(0)

// Playback speed state
const playbackSpeed = ref<PlaybackSpeed>(1)
const showSpeedIndicator = ref(false)
let speedIndicatorTimeout: ReturnType<typeof setTimeout> | null = null

// Subtitle styling composable
const { subtitleStyle, saveSubtitleStyle, applySubtitleStyle } = useSubtitleStyle()
const { t } = useLanguage()

// Double-tap seek state (mobile)
const lastTapTime = ref(0)
const lastTapX = ref(0)
const seekIndicator = ref<{ show: boolean; side: 'left' | 'right'; text: string }>({
  show: false,
  side: 'left',
  text: ''
})
let seekIndicatorTimeout: ReturnType<typeof setTimeout> | null = null

// Gesture state for swipe indicators
const swipeSeekPreview = ref<{ show: boolean; time: string; delta: number }>({
  show: false,
  time: '',
  delta: 0,
})
const volumeIndicator = ref<{ show: boolean; value: number }>({
  show: false,
  value: 0,
})
let gestureIndicatorTimeout: ReturnType<typeof setTimeout> | null = null

let controlsTimeout: ReturnType<typeof setTimeout> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null

const progress = computed(() => {
  if (videoDuration.value === 0) return 0
  return (currentTime.value / videoDuration.value) * 100
})

const timeDisplay = computed(() => {
  return `${formatTime(currentTime.value)} / ${formatTime(videoDuration.value)}`
})

// Check if this is a direct video URL (blob, mp4, etc.) vs HLS stream
const isDirectVideoUrl = computed(() => {
  const url = props.streamUrl
  if (!url) return false
  // Blob URLs are always direct video
  if (url.startsWith('blob:')) return true
  // Check for common video file extensions
  if (/\.(mp4|webm|mkv|avi|mov)(\?|$)/i.test(url)) return true
  return false
})

// Initialize HLS player (Jellyfin streams are always HLS, but offline is direct MP4)
const initPlayer = () => {
  const video = videoRef.value
  if (!video || !props.streamUrl) return

  isLoading.value = true
  hasError.value = false

  // For blob URLs (offline cached videos), use native video playback
  if (isDirectVideoUrl.value) {
    video.src = props.streamUrl
    video.addEventListener('loadedmetadata', () => {
      isLoading.value = false
      checkResumePosition()
    }, { once: true })
  } else if (Hls.isSupported()) {
    // Jellyfin streams are HLS - use HLS.js
    hls.value = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      maxBufferSize: 120 * 1000000,
    })

    hls.value.loadSource(props.streamUrl)
    hls.value.attachMedia(video)

    hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
      isLoading.value = false
      checkResumePosition()
    })

    hls.value.on(Hls.Events.ERROR, (_event, data) => {
      console.error('HLS error:', data)
      if (data.fatal) {
        hasError.value = true
        errorMessage.value = 'Failed to load video stream'
        isLoading.value = false
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS support (Safari)
    video.src = props.streamUrl
    video.addEventListener('loadedmetadata', () => {
      isLoading.value = false
      checkResumePosition()
    }, { once: true })
  }

  // Common event listeners
  video.addEventListener('playing', () => {
    isPlaying.value = true
    isLoading.value = false
  })

  video.addEventListener('pause', () => {
    isPlaying.value = false
  })

  video.addEventListener('timeupdate', () => {
    currentTime.value = video.currentTime
  })

  video.addEventListener('durationchange', () => {
    // Prefer duration from props (from Jellyfin) over video element duration
    if (props.duration && props.duration > 0) {
      videoDuration.value = props.duration / 1000 // Convert ms to seconds
    } else if (video.duration && isFinite(video.duration)) {
      videoDuration.value = video.duration
    }
  })

  video.addEventListener('ended', () => {
    isPlaying.value = false
    reportProgress('stopped')
    emit('ended')
  })

  video.addEventListener('waiting', () => {
    isLoading.value = true
  })

  video.addEventListener('canplay', () => {
    isLoading.value = false
  })

  video.addEventListener('error', () => {
    hasError.value = true
    errorMessage.value = 'Failed to play video'
    isLoading.value = false
  })

  video.addEventListener('volumechange', () => {
    volume.value = video.volume
    isMuted.value = video.muted
  })

  // Track buffered progress
  video.addEventListener('progress', () => {
    if (video.buffered.length > 0 && video.duration > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1)
      bufferedProgress.value = (bufferedEnd / video.duration) * 100
    }
  })

  // Apply subtitle style on load
  applySubtitleStyle()
}

const checkResumePosition = () => {
  if (props.resumePosition && props.resumePosition > 0) {
    const resumeSeconds = props.resumePosition / 1000
    // Only show resume prompt if we're more than 30 seconds in and not near the end
    if (resumeSeconds > 30 && videoDuration.value > 0 && resumeSeconds < videoDuration.value - 60) {
      showResumePrompt.value = true
    }
  }
}

const resumeFromPosition = () => {
  if (videoRef.value && props.resumePosition) {
    videoRef.value.currentTime = props.resumePosition / 1000
  }
  showResumePrompt.value = false
  play()
}

const startFromBeginning = () => {
  showResumePrompt.value = false
  play()
}

// Playback controls
const togglePlay = () => {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

const play = () => {
  videoRef.value?.play()
}

const pause = () => {
  videoRef.value?.pause()
}

const seek = (value: number | number[]) => {
  const seekValue = Array.isArray(value) ? value[0] : value
  if (videoRef.value && videoDuration.value > 0) {
    const newTime = (seekValue / 100) * videoDuration.value
    currentTime.value = newTime
    videoRef.value.currentTime = newTime
  }
}

const seekRelative = (seconds: number) => {
  if (videoRef.value) {
    const newTime = Math.max(0, Math.min(videoDuration.value, currentTime.value + seconds))
    videoRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

const toggleMute = () => {
  if (videoRef.value) {
    videoRef.value.muted = !videoRef.value.muted
  }
}

// Playback speed controls
const setPlaybackSpeed = (speed: PlaybackSpeed) => {
  if (videoRef.value) {
    videoRef.value.playbackRate = speed
    playbackSpeed.value = speed
    showSpeedIndicatorTemporarily()
  }
}

const increaseSpeed = () => {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed.value)
  if (currentIndex < PLAYBACK_SPEEDS.length - 1) {
    setPlaybackSpeed(PLAYBACK_SPEEDS[currentIndex + 1])
  }
}

const decreaseSpeed = () => {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed.value)
  if (currentIndex > 0) {
    setPlaybackSpeed(PLAYBACK_SPEEDS[currentIndex - 1])
  }
}

const showSpeedIndicatorTemporarily = () => {
  showSpeedIndicator.value = true
  if (speedIndicatorTimeout) {
    clearTimeout(speedIndicatorTimeout)
  }
  speedIndicatorTimeout = setTimeout(() => {
    showSpeedIndicator.value = false
  }, 1500)
}

// Frame stepping (when paused)
const stepFrame = (direction: 'forward' | 'backward') => {
  if (videoRef.value && !isPlaying.value) {
    // Approximate frame duration at 24fps = ~0.042s
    const frameDuration = 1 / 24
    const newTime = direction === 'forward'
      ? Math.min(videoDuration.value, currentTime.value + frameDuration)
      : Math.max(0, currentTime.value - frameDuration)
    videoRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

// Seek to percentage
const seekToPercent = (percent: number) => {
  if (videoRef.value && videoDuration.value > 0) {
    const newTime = (percent / 100) * videoDuration.value
    videoRef.value.currentTime = newTime
    currentTime.value = newTime
  }
}

// Toggle subtitles on/off
const toggleSubtitles = () => {
  if (selectedSubtitle.value !== null) {
    loadSubtitle(null)
  } else if (props.subtitles && props.subtitles.length > 0) {
    loadSubtitle(props.subtitles[0].id)
  }
}

// Cycle through subtitle tracks
const cycleSubtitles = () => {
  if (!props.subtitles || props.subtitles.length === 0) return

  if (selectedSubtitle.value === null) {
    loadSubtitle(props.subtitles[0].id)
  } else {
    const currentIndex = props.subtitles.findIndex(s => s.id === selectedSubtitle.value)
    if (currentIndex === props.subtitles.length - 1) {
      loadSubtitle(null) // Turn off after last track
    } else {
      loadSubtitle(props.subtitles[currentIndex + 1].id)
    }
  }
}

// Cycle through audio tracks
const cycleAudioTracks = () => {
  if (!props.audioTracks || props.audioTracks.length <= 1) return

  const currentIndex = props.audioTracks.findIndex(a => a.streamIndex === selectedAudioTrack.value)
  const nextIndex = (currentIndex + 1) % props.audioTracks.length
  switchAudioTrack(props.audioTracks[nextIndex].streamIndex)
}

// Double-tap seek handler (mobile)
const handleDoubleTapSeek = (clientX: number) => {
  const container = containerRef.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const tapX = clientX - rect.left
  const isLeftSide = tapX < rect.width / 2

  if (isLeftSide) {
    seekRelative(-10)
    showSeekIndicator('left', '-10s')
  } else {
    seekRelative(10)
    showSeekIndicator('right', '+10s')
  }
}

const showSeekIndicator = (side: 'left' | 'right', text: string) => {
  seekIndicator.value = { show: true, side, text }
  if (seekIndicatorTimeout) {
    clearTimeout(seekIndicatorTimeout)
  }
  seekIndicatorTimeout = setTimeout(() => {
    seekIndicator.value.show = false
  }, 600)
}

const handleTouchStart = (e: TouchEvent) => {
  const now = Date.now()
  const touch = e.touches[0]

  // Detect double tap (within 300ms and similar position)
  if (now - lastTapTime.value < 300 && Math.abs(touch.clientX - lastTapX.value) < 50) {
    e.preventDefault()
    handleDoubleTapSeek(touch.clientX)
  }

  lastTapTime.value = now
  lastTapX.value = touch.clientX
}

// Hide gesture indicator after a delay
const hideGestureIndicator = () => {
  if (gestureIndicatorTimeout) {
    clearTimeout(gestureIndicatorTimeout)
  }
  gestureIndicatorTimeout = setTimeout(() => {
    swipeSeekPreview.value.show = false
    volumeIndicator.value.show = false
  }, 500)
}

// Set up touch gesture handlers using composable
useTouchGestures(containerRef, {
  onDoubleTapLeft: () => {
    seekRelative(-10)
    showSeekIndicator('left', '-10s')
  },
  onDoubleTapRight: () => {
    seekRelative(10)
    showSeekIndicator('right', '+10s')
  },
  onDoubleTapCenter: () => {
    togglePlay()
  },
  onSwipeHorizontal: (deltaX: number) => {
    // Convert swipe distance to seek time (100px = 10 seconds)
    const seekSeconds = Math.round(deltaX / 10)
    if (seekSeconds !== 0) {
      seekRelative(seekSeconds)
      showSeekIndicator(seekSeconds > 0 ? 'right' : 'left', `${seekSeconds > 0 ? '+' : ''}${seekSeconds}s`)
    }
  },
  onSwipeVerticalRight: (deltaY: number) => {
    // Volume control on right side (100px = 0.5 volume change)
    const volumeChange = deltaY / 200
    const newVolume = Math.max(0, Math.min(1, volume.value + volumeChange))
    setVolume(newVolume)
    volumeIndicator.value = { show: true, value: Math.round(newVolume * 100) }
    hideGestureIndicator()
  },
  onTap: () => {
    showControlsTemporarily()
  },
})

// Toggle settings menu
const toggleSettings = () => {
  showSettings.value = !showSettings.value
  settingsTab.value = 'main'
}

// Subtitle options for display
const subtitleOptions = computed(() => {
  const options = [{ label: t('player.off'), value: null as number | null }]
  if (props.subtitles) {
    props.subtitles.forEach(sub => {
      options.push({ label: sub.displayTitle, value: sub.id })
    })
  }
  return options
})

// Load and activate subtitle track
const loadSubtitle = async (subtitleId: number | null) => {
  const video = videoRef.value
  if (!video) return

  // Remove all existing text tracks (except those already in the video)
  const existingTracks = video.querySelectorAll('track')
  existingTracks.forEach(track => track.remove())

  // Hide all text tracks
  for (let i = 0; i < video.textTracks.length; i++) {
    video.textTracks[i].mode = 'hidden'
  }

  if (subtitleId === null) {
    return
  }

  // Find the selected subtitle
  const subtitle = props.subtitles?.find(s => s.id === subtitleId)
  if (!subtitle?.url) {
    console.error('Subtitle not found or no URL:', subtitleId)
    return
  }

  // Create and add the track element
  const track = document.createElement('track')
  track.kind = 'subtitles'
  track.label = subtitle.displayTitle
  track.srclang = subtitle.languageCode
  track.src = subtitle.url
  track.default = true

  // Add track to video
  video.appendChild(track)

  // Wait for track to load and then show it
  track.addEventListener('load', () => {
    // Find and enable this track
    for (let i = 0; i < video.textTracks.length; i++) {
      if (video.textTracks[i].label === subtitle.displayTitle) {
        video.textTracks[i].mode = 'showing'
        break
      }
    }
  })

  track.addEventListener('error', (e) => {
    console.error('Subtitle track error:', e)
  })
}

// Watch for subtitle selection changes
watch(selectedSubtitle, (newValue) => {
  loadSubtitle(newValue)
})

// Initialize subtitle search
const initSubtitleSearch = async () => {
  try {
    const status = await subtitleService.getStatus()
    subtitleSearchEnabled.value = status.enabled
    subtitleLanguages.value = status.languages
  } catch (error) {
    console.error('Failed to initialize subtitle search:', error)
    subtitleSearchEnabled.value = false
  }
}

// Search for subtitles
const searchSubtitles = async () => {
  if (!props.title) {
    subtitleSearchError.value = 'Cannot search subtitles without media title'
    return
  }

  isSearchingSubtitles.value = true
  subtitleSearchError.value = ''
  subtitleSearchResults.value = []

  try {
    const results = await subtitleService.searchSubtitles({
      query: props.title,
      language: selectedSearchLanguage.value,
      type: props.mediaType === 'tv' ? 'episode' : props.mediaType,
      season: props.seasonNumber,
      episode: props.episodeNumber,
    })
    subtitleSearchResults.value = results
    if (results.length === 0) {
      subtitleSearchError.value = 'No subtitles found for this language'
    }
  } catch (error) {
    console.error('Subtitle search error:', error)
    subtitleSearchError.value = 'Failed to search subtitles'
  } finally {
    isSearchingSubtitles.value = false
  }
}

// Download and load subtitle directly into video player
const downloadSubtitle = async (result: SubtitleSearchResult) => {
  if (!result.fileId) {
    subtitleSearchError.value = 'Invalid subtitle file'
    return
  }

  isDownloadingSubtitle.value = true
  subtitleSearchError.value = ''

  try {
    const content = await subtitleService.downloadSubtitle(result.fileId)
    if (content) {
      // Create a blob URL from the subtitle content
      const blob = new Blob([content], { type: 'text/vtt' })
      const blobUrl = URL.createObjectURL(blob)

      // Load the subtitle into the video player
      if (videoRef.value) {
        // Remove existing custom tracks
        const tracks = videoRef.value.getElementsByTagName('track')
        for (let i = tracks.length - 1; i >= 0; i--) {
          const track = tracks[i]
          if (track.getAttribute('data-custom') === 'true') {
            videoRef.value.removeChild(track)
          }
        }

        // Add new track
        const track = document.createElement('track')
        track.kind = 'subtitles'
        track.label = result.name || 'Downloaded Subtitle'
        track.srclang = result.language || 'en'
        track.src = blobUrl
        track.setAttribute('data-custom', 'true')
        track.default = true
        videoRef.value.appendChild(track)

        // Activate the track
        track.addEventListener('load', () => {
          const textTracks = videoRef.value?.textTracks
          if (textTracks) {
            for (let i = 0; i < textTracks.length; i++) {
              textTracks[i].mode = textTracks[i].label === track.label ? 'showing' : 'hidden'
            }
          }
        })
      }

      // Clear search results and show success message
      subtitleSearchResults.value = []
      subtitleSearchError.value = 'Subtitle loaded!'
      settingsTab.value = 'main'
    } else {
      subtitleSearchError.value = 'Failed to download subtitle'
    }
  } catch (error) {
    console.error('Subtitle download error:', error)
    subtitleSearchError.value = 'Failed to download subtitle'
  } finally {
    isDownloadingSubtitle.value = false
  }
}

// Open subtitle search tab
const openSubtitleSearch = () => {
  settingsTab.value = 'subtitleSearch'
  subtitleSearchResults.value = []
  subtitleSearchError.value = ''
}

const setVolume = (value: number | number[]) => {
  const volumeValue = Array.isArray(value) ? value[0] : value
  if (videoRef.value) {
    videoRef.value.volume = volumeValue
    if (volumeValue > 0 && videoRef.value.muted) {
      videoRef.value.muted = false
    }
  }
}

// Check if audio track switching is available
const canSwitchAudio = computed(() => {
  return props.audioTracks && props.audioTracks.length > 1 && props.jellyfinItemId
})

// Initialize audio track from props
const initAudioTrack = () => {
  if (props.audioTracks) {
    const selected = props.audioTracks.find(t => t.selected)
    if (selected) {
      selectedAudioTrack.value = selected.streamIndex
    }
  }
}

// Switch audio track via Jellyfin
const switchAudioTrack = async (streamIndex: number) => {
  if (!canSwitchAudio.value || streamIndex === selectedAudioTrack.value) return
  if (!props.jellyfinItemId || !props.jellyfinMediaSourceId || !props.jellyfinPlaySessionId) return

  const wasPlaying = isPlaying.value
  const currentPos = currentTime.value
  const currentPlaybackRate = videoRef.value?.playbackRate || 1

  isLoading.value = true
  selectedAudioTrack.value = streamIndex

  const newHlsUrl = await mediaService.getJellyfinAudioTrackUrl(
    props.jellyfinItemId,
    streamIndex,
    props.jellyfinMediaSourceId,
    props.jellyfinPlaySessionId
  )

  if (newHlsUrl && videoRef.value) {
    // Cleanup existing HLS instance
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    // Initialize new HLS stream with different audio track
    if (Hls.isSupported()) {
      hls.value = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
      })

      hls.value.loadSource(newHlsUrl)
      hls.value.attachMedia(videoRef.value)

      hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
        isLoading.value = false
        if (videoRef.value) {
          // Seek to the position we were at
          videoRef.value.currentTime = currentPos
          videoRef.value.playbackRate = currentPlaybackRate
          if (wasPlaying) {
            videoRef.value.play()
          }
        }
      })

      hls.value.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error during audio switch:', data)
        if (data.fatal) {
          isLoading.value = false
        }
      })
    } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      videoRef.value.src = newHlsUrl
      videoRef.value.addEventListener('loadedmetadata', () => {
        isLoading.value = false
        if (videoRef.value) {
          videoRef.value.currentTime = currentPos
          videoRef.value.playbackRate = currentPlaybackRate
          if (wasPlaying) {
            videoRef.value.play()
          }
        }
      }, { once: true })
    }
  } else {
    console.error('Failed to get Jellyfin audio track URL')
    isLoading.value = false
  }
}

const toggleFullscreen = async () => {
  if (!containerRef.value) return

  try {
    if (!document.fullscreenElement) {
      await containerRef.value.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (err) {
    console.error('Fullscreen error:', err)
  }
}

// Report progress to parent and Jellyfin
const reportProgress = async (state: 'playing' | 'paused' | 'stopped') => {
  const positionMs = Math.floor(currentTime.value * 1000)

  // Report to parent callback
  if (props.onProgress && currentTime.value > 0) {
    props.onProgress(positionMs, state)
  }

  // Report to Jellyfin
  if (props.jellyfinItemId && props.jellyfinMediaSourceId && props.jellyfinPlaySessionId) {
    // Report playback started once (required before progress updates work)
    if (!hasReportedStarted.value) {
      await mediaService.reportJellyfinStarted(
        props.jellyfinItemId,
        props.jellyfinMediaSourceId,
        props.jellyfinPlaySessionId
      )
      hasReportedStarted.value = true
    }

    if (state === 'stopped') {
      mediaService.reportJellyfinStopped(props.jellyfinItemId, positionMs)
    } else {
      mediaService.reportJellyfinProgress(props.jellyfinItemId, positionMs, state === 'paused')
    }
  }
}

// Controls visibility
const showControlsTemporarily = () => {
  showControls.value = true
  if (controlsTimeout) {
    clearTimeout(controlsTimeout)
  }
  if (isPlaying.value) {
    controlsTimeout = setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

const handleMouseMove = () => {
  showControlsTemporarily()
}

const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
    case 'j':
      e.preventDefault()
      seekRelative(-10)
      break
    case 'ArrowRight':
    case 'l':
      e.preventDefault()
      seekRelative(10)
      break
    case 'ArrowUp':
      e.preventDefault()
      setVolume(Math.min(1, volume.value + 0.1))
      break
    case 'ArrowDown':
      e.preventDefault()
      setVolume(Math.max(0, volume.value - 0.1))
      break
    case 'f':
      e.preventDefault()
      toggleFullscreen()
      break
    case 'm':
      e.preventDefault()
      toggleMute()
      break
    case ',':
      e.preventDefault()
      stepFrame('backward')
      break
    case '.':
      e.preventDefault()
      stepFrame('forward')
      break
    case '<':
      e.preventDefault()
      decreaseSpeed()
      break
    case '>':
      e.preventDefault()
      increaseSpeed()
      break
    case 'c':
      e.preventDefault()
      toggleSubtitles()
      break
    case 's':
      e.preventDefault()
      cycleSubtitles()
      break
    case 'a':
      e.preventDefault()
      cycleAudioTracks()
      break
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      e.preventDefault()
      seekToPercent(parseInt(e.key) * 10)
      break
    case 'Escape':
      if (!document.fullscreenElement) {
        emit('close')
      }
      break
  }
  showControlsTemporarily()
}

// Handle fullscreen change from browser
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// Cleanup
const cleanup = async () => {
  if (hls.value) {
    hls.value.destroy()
    hls.value = null
  }
  if (controlsTimeout) {
    clearTimeout(controlsTimeout)
  }
  if (progressInterval) {
    clearInterval(progressInterval)
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
}

// Lifecycle
onMounted(() => {
  // Set initial duration from props if available
  if (props.duration && props.duration > 0) {
    videoDuration.value = props.duration / 1000 // Convert ms to seconds
  }

  // Initialize audio track from props
  initAudioTrack()

  // Initialize subtitle search availability
  initSubtitleSearch()

  initPlayer()
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // Report progress every 10 seconds
  progressInterval = setInterval(() => {
    if (isPlaying.value) {
      reportProgress('playing')
    }
  }, 10000)
})

onUnmounted(() => {
  reportProgress(isPlaying.value ? 'paused' : 'stopped')
  cleanup()
})

watch(() => props.streamUrl, () => {
  cleanup()
  initPlayer()
})

// Expose for parent component
defineExpose({
  play,
  pause,
  seek
})
</script>

<template>
  <div
    ref="containerRef"
    class="video-player relative w-full h-full bg-black select-none"
    :class="{ 'cursor-none': !showControls && isPlaying }"
    @mousemove="handleMouseMove"
    @keydown="handleKeydown"
    @touchstart="handleTouchStart"
    tabindex="0"
  >
    <!-- Video Element -->
    <video
      ref="videoRef"
      class="w-full h-full"
      playsinline
      crossorigin="anonymous"
      @click="togglePlay"
      @dblclick="toggleFullscreen"
    />

    <!-- Double-tap Seek Indicator (Mobile) -->
    <Transition name="seek-fade">
      <div
        v-if="seekIndicator.show"
        class="absolute inset-y-0 flex items-center pointer-events-none"
        :class="seekIndicator.side === 'left' ? 'left-16' : 'right-16'"
      >
        <div class="flex flex-col items-center gap-2">
          <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <i :class="seekIndicator.side === 'left' ? 'pi pi-replay' : 'pi pi-forward'" class="text-2xl text-white"></i>
          </div>
          <span class="text-white text-lg font-semibold">{{ seekIndicator.text }}</span>
        </div>
      </div>
    </Transition>

    <!-- Playback Speed Indicator -->
    <Transition name="seek-fade">
      <div
        v-if="showSpeedIndicator"
        class="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
      >
        <div class="bg-black/70 rounded-lg px-6 py-3">
          <span class="text-white text-2xl font-bold">{{ playbackSpeed }}x</span>
        </div>
      </div>
    </Transition>

    <!-- Volume Gesture Indicator (Mobile) -->
    <Transition name="seek-fade">
      <div
        v-if="volumeIndicator.show"
        class="absolute inset-y-0 right-8 flex items-center pointer-events-none z-30"
      >
        <div class="bg-black/70 rounded-lg px-4 py-3 flex flex-col items-center gap-2">
          <i class="pi pi-volume-up text-white text-xl"></i>
          <div class="w-1 h-20 bg-white/30 rounded-full relative">
            <div
              class="absolute bottom-0 left-0 right-0 bg-white rounded-full transition-all"
              :style="{ height: `${volumeIndicator.value}%` }"
            />
          </div>
          <span class="text-white text-sm font-bold">{{ volumeIndicator.value }}%</span>
        </div>
      </div>
    </Transition>

    <!-- Loading Spinner -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-black/50"
    >
      <i class="pi pi-spin pi-spinner text-5xl text-white"></i>
    </div>

    <!-- Error State -->
    <div
      v-if="hasError"
      class="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
    >
      <i class="pi pi-exclamation-triangle text-5xl text-red-500 mb-4"></i>
      <p class="text-white text-lg mb-4">{{ errorMessage }}</p>
      <Button label="Close" severity="secondary" @click="emit('close')" />
    </div>

    <!-- Resume Prompt -->
    <div
      v-if="showResumePrompt"
      class="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
    >
      <div class="bg-zinc-900 rounded-xl p-6 max-w-md text-center">
        <p class="text-white text-lg mb-2">{{ t('player.resumePlayback') }}</p>
        <p class="text-gray-400 mb-6">
          {{ t('player.continueFrom', { time: formatTime((resumePosition || 0) / 1000) }) }}
        </p>
        <div class="flex gap-3 justify-center">
          <Button
            :label="t('player.startOver')"
            severity="secondary"
            @click="startFromBeginning"
          />
          <Button
            :label="t('player.resume')"
            @click="resumeFromPosition"
          />
        </div>
      </div>
    </div>

    <!-- Controls Overlay -->
    <div
      v-show="showControls && !showResumePrompt"
      class="absolute inset-0 flex flex-col justify-between transition-opacity duration-300"
      :class="showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <!-- Top Bar - Title -->
      <div class="bg-gradient-to-b from-black/80 to-transparent p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-white text-lg font-semibold truncate pr-4">{{ title }}</h2>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            @click="emit('close')"
            class="!text-white hover:!bg-white/20"
          />
        </div>
      </div>

      <!-- Center Play Button -->
      <div class="flex-1 flex items-center justify-center">
        <button
          v-if="!isPlaying && !isLoading"
          class="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          :aria-label="t('player.play')"
          @click="togglePlay"
        >
          <i class="pi pi-play text-4xl text-white ml-1"></i>
        </button>
      </div>

      <!-- Bottom Controls -->
      <div class="bg-gradient-to-t from-black/80 to-transparent p-4">
        <!-- Progress Bar with Buffering Indicator -->
        <div class="mb-3 relative">
          <!-- Buffered Progress (gray background bar) -->
          <div class="absolute inset-y-0 my-auto left-0 right-0 h-1 bg-white/20 rounded">
            <div
              class="h-full bg-white/40 rounded transition-all duration-300"
              :style="{ width: `${bufferedProgress}%` }"
            />
          </div>
          <!-- Playback Progress Slider -->
          <Slider
            :modelValue="progress"
            @update:modelValue="seek"
            :min="0"
            :max="100"
            :step="0.1"
            class="w-full video-progress-slider relative z-10"
          />
        </div>

        <!-- Control Buttons -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <!-- Play/Pause -->
            <Button
              :icon="isPlaying ? 'pi pi-pause' : 'pi pi-play'"
              severity="secondary"
              text
              rounded
              @click="togglePlay"
              class="!text-white hover:!bg-white/20"
            />

            <!-- Rewind 10s -->
            <Button
              icon="pi pi-replay"
              severity="secondary"
              text
              rounded
              @click="seekRelative(-10)"
              class="!text-white hover:!bg-white/20"
              v-tooltip.top="'-10s'"
            />

            <!-- Forward 10s -->
            <Button
              icon="pi pi-forward"
              severity="secondary"
              text
              rounded
              @click="seekRelative(10)"
              class="!text-white hover:!bg-white/20"
              v-tooltip.top="'+10s'"
            />

            <!-- Volume -->
            <div class="flex items-center gap-2 ml-2">
              <Button
                :icon="isMuted || volume === 0 ? 'pi pi-volume-off' : 'pi pi-volume-up'"
                severity="secondary"
                text
                rounded
                @click="toggleMute"
                class="!text-white hover:!bg-white/20"
              />
              <Slider
                :modelValue="isMuted ? 0 : volume * 100"
                @update:modelValue="(v: number | number[]) => setVolume((Array.isArray(v) ? v[0] : v) / 100)"
                :min="0"
                :max="100"
                class="w-20 volume-slider"
              />
            </div>

            <!-- Time Display -->
            <span class="text-white text-sm ml-4 font-mono">{{ timeDisplay }}</span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Settings -->
            <div class="relative">
              <Button
                icon="pi pi-cog"
                severity="secondary"
                text
                rounded
                @click="toggleSettings"
                class="!text-white hover:!bg-white/20"
                v-tooltip.top="'Settings'"
              />

              <!-- Settings Menu -->
              <div
                v-if="showSettings"
                class="absolute bottom-12 right-0 bg-zinc-900/95 backdrop-blur-sm rounded-lg shadow-xl border border-zinc-700 z-20 min-w-[250px] max-h-[400px] overflow-y-auto"
                @click.stop
              >
                <!-- Main Settings Tab -->
                <div v-if="settingsTab === 'main'" class="p-4">
                  <!-- Audio Track Selection -->
                  <div v-if="audioTracks && audioTracks.length > 1" class="mb-4">
                    <label class="text-gray-400 text-xs uppercase tracking-wide mb-2 block">{{ t('player.audio') }}</label>
                    <div class="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      <button
                        v-for="track in audioTracks"
                        :key="track.id"
                        class="text-left px-3 py-2 rounded text-sm transition-colors"
                        :class="selectedAudioTrack === track.streamIndex ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-zinc-700'"
                        @click="switchAudioTrack(track.streamIndex)"
                      >
                        {{ track.displayTitle }}
                      </button>
                    </div>
                  </div>

                  <!-- Subtitle Selection -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-gray-400 text-xs uppercase tracking-wide">{{ t('player.subtitles') }}</label>
                      <div class="flex items-center gap-2">
                        <button
                          v-if="subtitleSearchEnabled"
                          class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          @click="openSubtitleSearch"
                        >
                          <i class="pi pi-search text-xs mr-1"></i>{{ t('player.findSubtitles') }}
                        </button>
                        <button
                          v-if="subtitles && subtitles.length > 0"
                          class="text-xs text-gray-400 hover:text-white transition-colors"
                          @click="settingsTab = 'subtitleStyle'"
                        >
                          {{ t('player.style') }} <i class="pi pi-chevron-right text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <div v-if="subtitles && subtitles.length > 0" class="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      <button
                        v-for="option in subtitleOptions"
                        :key="option.value ?? 'off'"
                        class="text-left px-3 py-2 rounded text-sm transition-colors"
                        :class="selectedSubtitle === option.value ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-zinc-700'"
                        @click="selectedSubtitle = option.value"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                    <div v-else class="text-gray-500 text-sm py-2">
                      {{ t('player.noSubtitlesAvailable') }}
                    </div>
                  </div>
                </div>

                <!-- Subtitle Style Tab -->
                <div v-else-if="settingsTab === 'subtitleStyle'" class="p-4">
                  <button
                    class="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                    @click="settingsTab = 'main'"
                  >
                    <i class="pi pi-chevron-left text-xs"></i>
                    <span class="text-sm">{{ t('player.subtitleStyle') }}</span>
                  </button>

                  <!-- Font Size -->
                  <div class="mb-4">
                    <label class="text-gray-400 text-xs uppercase tracking-wide mb-2 block">{{ t('player.fontSize') }}</label>
                    <div class="flex flex-wrap gap-1">
                      <button
                        v-for="option in fontSizeOptions"
                        :key="option.value"
                        class="px-3 py-1.5 rounded text-sm transition-colors"
                        :class="subtitleStyle.fontSize === option.value ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-zinc-700'"
                        @click="subtitleStyle.fontSize = option.value; saveSubtitleStyle()"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Font Color -->
                  <div class="mb-4">
                    <label class="text-gray-400 text-xs uppercase tracking-wide mb-2 block">{{ t('player.fontColor') }}</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="option in fontColorOptions"
                        :key="option.value"
                        class="w-8 h-8 rounded-full border-2 transition-all"
                        :class="subtitleStyle.fontColor === option.value ? 'border-red-500 scale-110' : 'border-transparent hover:border-gray-500'"
                        :style="{ backgroundColor: option.value }"
                        :title="option.label"
                        @click="subtitleStyle.fontColor = option.value; saveSubtitleStyle()"
                      />
                    </div>
                  </div>

                  <!-- Background Opacity -->
                  <div>
                    <label class="text-gray-400 text-xs uppercase tracking-wide mb-2 block">{{ t('player.backgroundColor') }}</label>
                    <div class="flex flex-wrap gap-1">
                      <button
                        v-for="option in bgOpacityOptions"
                        :key="option.value"
                        class="px-3 py-1.5 rounded text-sm transition-colors"
                        :class="subtitleStyle.backgroundOpacity === option.value ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-zinc-700'"
                        @click="subtitleStyle.backgroundOpacity = option.value; saveSubtitleStyle()"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Subtitle Search Tab -->
                <div v-else-if="settingsTab === 'subtitleSearch'" class="p-4 min-w-[300px]">
                  <button
                    class="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
                    @click="settingsTab = 'main'"
                  >
                    <i class="pi pi-chevron-left text-xs"></i>
                    <span class="text-sm">{{ t('player.findSubtitles') }}</span>
                  </button>

                  <!-- Language Selection -->
                  <div class="mb-4">
                    <label class="text-gray-400 text-xs uppercase tracking-wide mb-2 block">{{ t('player.subtitleLanguage') }}</label>
                    <select
                      v-model="selectedSearchLanguage"
                      class="w-full bg-zinc-800 text-white text-sm rounded px-3 py-2 border border-zinc-600 focus:border-red-500 focus:outline-none"
                    >
                      <option v-for="lang in subtitleLanguages" :key="lang.code" :value="lang.code">
                        {{ lang.name }}
                      </option>
                    </select>
                  </div>

                  <!-- Search Button -->
                  <button
                    class="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 mb-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    :disabled="isSearchingSubtitles"
                    @click="searchSubtitles"
                  >
                    <i v-if="isSearchingSubtitles" class="pi pi-spin pi-spinner"></i>
                    <i v-else class="pi pi-search"></i>
                    {{ isSearchingSubtitles ? t('player.searching') : t('common.search') }}
                  </button>

                  <!-- Error/Success Message -->
                  <div v-if="subtitleSearchError" class="text-sm mb-3 px-2 py-1.5 rounded" :class="subtitleSearchError.includes('downloaded') ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'">
                    {{ subtitleSearchError }}
                  </div>

                  <!-- Search Results -->
                  <div v-if="subtitleSearchResults.length > 0" class="max-h-48 overflow-y-auto">
                    <div class="text-gray-400 text-xs uppercase tracking-wide mb-2">{{ t('player.results') }}</div>
                    <div class="flex flex-col gap-1">
                      <button
                        v-for="result in subtitleSearchResults"
                        :key="result.id"
                        class="text-left px-3 py-2 rounded text-sm transition-colors bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50"
                        :disabled="isDownloadingSubtitle"
                        @click="downloadSubtitle(result)"
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-white truncate flex-1 mr-2">{{ result.name }}</span>
                          <span v-if="result.isHashMatch" class="text-green-500 text-xs px-1.5 py-0.5 bg-green-900/30 rounded">Match</span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <span>{{ result.providerName }}</span>
                          <span v-if="result.downloadCount">{{ result.downloadCount.toLocaleString() }} downloads</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Fullscreen -->
            <Button
              :icon="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
              severity="secondary"
              text
              rounded
              @click="toggleFullscreen"
              class="!text-white hover:!bg-white/20"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Click outside to close settings -->
    <div
      v-if="showSettings"
      class="absolute inset-0 z-10"
      @click="showSettings = false"
    />
  </div>
</template>

<style>
.video-player:focus {
  outline: none;
}

/* Progress slider styling */
.video-progress-slider.p-slider {
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.video-progress-slider.p-slider:hover {
  height: 6px;
}

.video-progress-slider .p-slider-range {
  background: #e50914;
}

.video-progress-slider .p-slider-handle {
  width: 14px;
  height: 14px;
  background: #e50914;
  border: none;
  margin-top: -5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.video-progress-slider:hover .p-slider-handle {
  opacity: 1;
}

/* Volume slider styling */
.volume-slider.p-slider {
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.volume-slider .p-slider-range {
  background: white;
}

.volume-slider .p-slider-handle {
  width: 12px;
  height: 12px;
  background: white;
  border: none;
  margin-top: -4px;
}

/* Seek indicator fade animation */
.seek-fade-enter-active,
.seek-fade-leave-active {
  transition: opacity 0.3s ease;
}

.seek-fade-enter-from,
.seek-fade-leave-to {
  opacity: 0;
}

/* Make progress slider background transparent for buffering indicator to show */
.video-progress-slider.p-slider {
  background: transparent;
}
</style>
