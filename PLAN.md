# Implementation Plan: New Features

## Overview

This plan covers the implementation of 5 major features:
1. PWA Push Notifications - New content alerts
2. Keyboard Shortcuts - Full keyboard navigation
3. Mobile Gesture Controls - Swipe to seek, double-tap to skip
4. Cast to TV - Chromecast/AirPlay support
5. Multi-language Support - Romanian and English

---

## 1. PWA Push Notifications

### Current State
- PWA already configured with vite-plugin-pwa
- Service worker active with runtime caching
- PrimeVue Toast for in-app notifications
- No push notification infrastructure

### Implementation Steps

#### Phase 1: Backend Setup
1. **Create notification routes** (`server/src/routes/notifications.ts`)
   - POST `/api/notifications/subscribe` - Store push subscription
   - POST `/api/notifications/unsubscribe` - Remove subscription
   - POST `/api/notifications/send` - Admin endpoint to send notifications

2. **Add web-push library to backend**
   ```bash
   cd server && npm install web-push
   ```

3. **Create notification service** (`server/src/services/notificationService.ts`)
   - Generate VAPID keys
   - Store subscriptions in SQLite
   - Send push notifications when:
     - New movie/show added to library
     - Download completed
     - Requested content becomes available

4. **Database migration** - Add `push_subscriptions` table
   ```sql
   CREATE TABLE push_subscriptions (
     id INTEGER PRIMARY KEY,
     endpoint TEXT UNIQUE,
     keys_p256dh TEXT,
     keys_auth TEXT,
     user_id INTEGER,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

#### Phase 2: Frontend Setup
5. **Create notification service** (`src/services/pushNotificationService.ts`)
   - Request notification permission
   - Subscribe to push notifications
   - Handle subscription management

6. **Create notification composable** (`src/composables/useNotifications.ts`)
   - Permission state
   - Subscription state
   - Subscribe/unsubscribe methods

7. **Update vite.config.ts** - Add notification handling to service worker
   ```typescript
   workbox: {
     // Add push event handler
     importScripts: ['push-handler.js']
   }
   ```

8. **Create push handler** (`public/push-handler.js`)
   - Handle push events
   - Display notifications with action buttons
   - Handle notification clicks

#### Phase 3: UI Integration
9. **Add notification settings** in Settings page
   - Toggle notifications on/off
   - Notification types selection (downloads, new content, etc.)

10. **Add notification bell icon** to header
    - Show unread count badge
    - Dropdown with recent notifications

### Files to Create/Modify
- `server/src/routes/notifications.ts` (new)
- `server/src/services/notificationService.ts` (new)
- `src/services/pushNotificationService.ts` (new)
- `src/composables/useNotifications.ts` (new)
- `public/push-handler.js` (new)
- `vite.config.ts` (modify)
- `src/components/layout/AppHeader.vue` (modify)

---

## 2. Keyboard Shortcuts - Full Navigation

### Current State
- VideoPlayer has 8 keyboard shortcuts (play/pause, seek, volume, fullscreen, mute, close)
- No global keyboard navigation
- No shortcut customization

### Implementation Steps

#### Phase 1: Global Keyboard Handler
1. **Create keyboard service** (`src/services/keyboardService.ts`)
   - Global keydown listener
   - Context-aware shortcuts (different shortcuts for different views)
   - Prevent conflicts with input fields

2. **Create keyboard composable** (`src/composables/useKeyboardShortcuts.ts`)
   - Register/unregister shortcuts
   - Shortcut groups by context
   - Execute shortcut actions

3. **Define shortcut map** (`src/config/keyboardShortcuts.ts`)
   ```typescript
   export const SHORTCUTS = {
     global: {
       '/': { action: 'focusSearch', description: 'Focus search' },
       'g h': { action: 'goHome', description: 'Go to Home' },
       'g b': { action: 'goBrowse', description: 'Go to Browse' },
       'g d': { action: 'goDownloads', description: 'Go to Downloads' },
       '?': { action: 'showHelp', description: 'Show keyboard shortcuts' },
     },
     player: {
       'j': { action: 'seekBack10', description: 'Seek back 10s' },
       'l': { action: 'seekForward10', description: 'Seek forward 10s' },
       ',': { action: 'prevFrame', description: 'Previous frame (paused)' },
       '.': { action: 'nextFrame', description: 'Next frame (paused)' },
       'c': { action: 'toggleSubtitles', description: 'Toggle subtitles' },
       's': { action: 'cycleSubtitles', description: 'Cycle subtitle tracks' },
       'a': { action: 'cycleAudio', description: 'Cycle audio tracks' },
       '<': { action: 'decreaseSpeed', description: 'Decrease playback speed' },
       '>': { action: 'increaseSpeed', description: 'Increase playback speed' },
       '0-9': { action: 'seekPercent', description: 'Seek to 0-90%' },
     },
     browse: {
       'ArrowLeft': { action: 'prevItem', description: 'Previous item' },
       'ArrowRight': { action: 'nextItem', description: 'Next item' },
       'ArrowUp': { action: 'prevRow', description: 'Previous row' },
       'ArrowDown': { action: 'nextRow', description: 'Next row' },
       'Enter': { action: 'openItem', description: 'Open selected item' },
     }
   }
   ```

#### Phase 2: Enhanced VideoPlayer Shortcuts
4. **Extend VideoPlayer.vue keyboard handling**
   - Add playback speed controls (<, >)
   - Add subtitle toggle (c) and cycle (s)
   - Add audio track cycle (a)
   - Add number keys for seeking (0-9 for 0%-90%)
   - Add frame stepping (,/. when paused)

5. **Add playback speed control**
   - Speed options: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2
   - Visual indicator when speed changes
   - Persist preference

#### Phase 3: Keyboard Help Modal
6. **Create KeyboardShortcutsModal.vue**
   - Grouped shortcuts by context
   - Searchable
   - Show current keybindings

7. **Add to App.vue**
   - Register global ? shortcut
   - Show modal on trigger

### Files to Create/Modify
- `src/config/keyboardShortcuts.ts` (new)
- `src/services/keyboardService.ts` (new)
- `src/composables/useKeyboardShortcuts.ts` (new)
- `src/components/common/KeyboardShortcutsModal.vue` (new)
- `src/components/media/VideoPlayer.vue` (modify - extend shortcuts)
- `src/App.vue` (modify - add global handler)

---

## 3. Mobile Gesture Controls

### Current State
- Double-tap seek already implemented (left -10s, right +10s)
- No swipe gestures
- No pinch-to-zoom
- Basic touch show/hide controls

### Implementation Steps

#### Phase 1: Gesture Recognition System
1. **Create gesture composable** (`src/composables/useGestures.ts`)
   - Track touch start/move/end
   - Detect gesture types:
     - Swipe (direction, velocity, distance)
     - Pinch (scale factor)
     - Long press
     - Double tap (already exists, refactor here)

2. **Define gesture thresholds**
   ```typescript
   const GESTURE_CONFIG = {
     swipe: {
       minDistance: 50,      // pixels
       maxDuration: 300,     // ms
       velocityThreshold: 0.3
     },
     pinch: {
       minScale: 0.1         // minimum scale change to register
     },
     longPress: {
       duration: 500         // ms
     }
   }
   ```

#### Phase 2: VideoPlayer Gestures
3. **Implement swipe gestures in VideoPlayer**
   - **Horizontal swipe**: Seek (proportional to swipe distance)
     - Show seek preview during swipe
     - Left = backward, Right = forward
   - **Vertical swipe left side**: Brightness (if supported)
   - **Vertical swipe right side**: Volume
     - Show volume indicator

4. **Implement pinch-to-zoom**
   - Zoom video within container
   - Pan when zoomed
   - Double-tap to reset zoom

5. **Add long-press menu**
   - Playback speed selection
   - Quality selection
   - Subtitle/audio selection

#### Phase 3: Visual Feedback
6. **Create gesture indicators**
   - Seek preview with timestamp
   - Volume/brightness bar
   - Zoom level indicator

7. **Add haptic feedback** (if supported)
   ```typescript
   if ('vibrate' in navigator) {
     navigator.vibrate(10) // Short vibration
   }
   ```

### Files to Create/Modify
- `src/composables/useGestures.ts` (new)
- `src/components/media/player/GestureOverlay.vue` (new)
- `src/components/media/player/SeekPreview.vue` (new)
- `src/components/media/player/VolumeIndicator.vue` (new)
- `src/components/media/VideoPlayer.vue` (modify - integrate gestures)

---

## 4. Cast to TV - Chromecast/AirPlay

### Current State
- No casting support
- HLS.js for playback
- Jellyfin backend for media streaming

### Implementation Steps

#### Phase 1: Chromecast Support
1. **Add Google Cast SDK** (`index.html`)
   ```html
   <script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"></script>
   ```

2. **Create cast service** (`src/services/castService.ts`)
   - Initialize Cast SDK
   - Discover cast devices
   - Load media on receiver
   - Control playback (play, pause, seek, volume)
   - Handle session events

3. **Create cast composable** (`src/composables/useCasting.ts`)
   - Cast availability state
   - Current session state
   - Active device info
   - Cast/stop methods

4. **Create custom receiver app** (optional, for branding)
   - Register with Google Cast Developer Console
   - Custom UI on TV

#### Phase 2: AirPlay Support
5. **Add AirPlay button to video element**
   - Safari/WebKit native support
   - Check for AirPlay availability
   ```typescript
   const supportsAirPlay = 'webkitShowPlaybackTargetPicker' in video
   ```

6. **Handle AirPlay events**
   - `webkitplaybacktargetavailabilitychanged`
   - `webkitcurrentplaybacktargetiswirelesschanged`

#### Phase 3: UI Integration
7. **Add cast button to VideoPlayer controls**
   - Show only when casting available
   - Different icons for Chromecast/AirPlay
   - Show connected device name

8. **Create CastDeviceSelector.vue**
   - List available devices
   - Show connection status
   - Allow device switching

9. **Handle media URL for casting**
   - Ensure stream URL is accessible from cast device
   - May need external URL vs internal URL

### Files to Create/Modify
- `index.html` (modify - add Cast SDK)
- `src/services/castService.ts` (new)
- `src/composables/useCasting.ts` (new)
- `src/components/media/player/CastButton.vue` (new)
- `src/components/media/player/CastDeviceSelector.vue` (new)
- `src/components/media/VideoPlayer.vue` (modify - add cast controls)

### Considerations
- Chromecast requires HTTPS in production
- Stream URLs must be accessible from the cast device (network routing)
- Consider fallback for incompatible media formats

---

## 5. Multi-language Support (Romanian/English)

### Current State
- All UI text is hardcoded in English
- No i18n library installed
- Subtitle language selection exists (backend supports Romanian)

### Implementation Steps

#### Phase 1: i18n Setup
1. **Install vue-i18n**
   ```bash
   npm install vue-i18n@next
   ```

2. **Create i18n configuration** (`src/i18n/index.ts`)
   ```typescript
   import { createI18n } from 'vue-i18n'
   import en from './locales/en.json'
   import ro from './locales/ro.json'

   export const i18n = createI18n({
     legacy: false,
     locale: localStorage.getItem('locale') || 'en',
     fallbackLocale: 'en',
     messages: { en, ro }
   })
   ```

3. **Create translation files**
   - `src/i18n/locales/en.json`
   - `src/i18n/locales/ro.json`

4. **Register in main.ts**
   ```typescript
   import { i18n } from './i18n'
   app.use(i18n)
   ```

#### Phase 2: Create Translation Files
5. **Structure translations by feature**
   ```json
   {
     "common": {
       "loading": "Loading...",
       "error": "Error",
       "save": "Save",
       "cancel": "Cancel"
     },
     "nav": {
       "home": "Home",
       "browse": "Browse",
       "downloads": "Downloads",
       "settings": "Settings"
     },
     "home": {
       "continueWatching": "Continue Watching",
       "trending": "Trending Now",
       "popular": "Popular"
     },
     "player": {
       "play": "Play",
       "pause": "Pause",
       "volume": "Volume",
       "fullscreen": "Fullscreen"
     },
     "media": {
       "movie": "Movie",
       "series": "Series",
       "season": "Season",
       "episode": "Episode"
     }
   }
   ```

#### Phase 3: Component Updates
6. **Update all components with translations**
   - Use `$t('key')` in templates
   - Use `useI18n()` in script setup
   ```vue
   <script setup>
   import { useI18n } from 'vue-i18n'
   const { t } = useI18n()
   </script>
   <template>
     <h1>{{ $t('home.trending') }}</h1>
   </template>
   ```

7. **Priority components to translate**
   - AppHeader.vue
   - AppSidebar.vue
   - HomeView.vue
   - MediaDetailView.vue
   - VideoPlayer.vue
   - BrowseView.vue
   - All modals

#### Phase 4: Language Switcher
8. **Create language composable** (`src/composables/useLanguage.ts`)
   ```typescript
   export function useLanguage() {
     const { locale } = useI18n()

     const setLanguage = (lang: 'en' | 'ro') => {
       locale.value = lang
       localStorage.setItem('locale', lang)
     }

     return { locale, setLanguage }
   }
   ```

9. **Create LanguageSelector.vue**
   - Dropdown or toggle
   - Show current language
   - Flag icons (optional)

10. **Add to settings/header**

#### Phase 5: Date/Number Formatting
11. **Configure locale-aware formatting**
    ```typescript
    const { d, n } = useI18n()
    // Date formatting
    d(new Date(), 'long') // "December 24, 2025" / "24 decembrie 2025"
    // Number formatting
    n(1234567.89, 'currency') // "$1,234,567.89" / "1.234.567,89 lei"
    ```

### Files to Create/Modify
- `src/i18n/index.ts` (new)
- `src/i18n/locales/en.json` (new)
- `src/i18n/locales/ro.json` (new)
- `src/composables/useLanguage.ts` (new)
- `src/components/common/LanguageSelector.vue` (new)
- `src/main.ts` (modify - register i18n)
- All `.vue` files with hardcoded text (modify)

### Translation Key Count Estimate
- Common: ~30 keys
- Navigation: ~10 keys
- Home page: ~25 keys
- Browse page: ~20 keys
- Media detail: ~40 keys
- Player: ~30 keys
- Downloads: ~20 keys
- Settings: ~25 keys
- Errors/Messages: ~30 keys
- **Total: ~230 keys**

---

## Implementation Order Recommendation

### Sprint 1: Foundation
1. **Keyboard Shortcuts** (2-3 days)
   - Builds on existing VideoPlayer code
   - Immediate UX improvement
   - No backend changes required

2. **Mobile Gesture Controls** (2-3 days)
   - Extends existing touch handling
   - Improves mobile experience
   - No backend changes required

### Sprint 2: Infrastructure
3. **Multi-language Support** (3-4 days)
   - Install and configure vue-i18n
   - Create translation files
   - Update high-priority components
   - Can be done incrementally

### Sprint 3: Advanced Features
4. **PWA Push Notifications** (3-4 days)
   - Requires backend changes
   - Service worker updates
   - User permission handling

5. **Cast to TV** (4-5 days)
   - External SDK integration
   - Network considerations
   - Device compatibility testing

---

## Testing Checklist

### Keyboard Shortcuts
- [ ] All shortcuts work in correct contexts
- [ ] No conflicts with browser shortcuts
- [ ] Shortcuts disabled when typing in inputs
- [ ] Help modal shows all shortcuts

### Mobile Gestures
- [ ] Swipe seek works smoothly
- [ ] Volume gesture responds correctly
- [ ] Pinch zoom works
- [ ] Visual feedback is clear
- [ ] No accidental triggers

### Multi-language
- [ ] All text translated
- [ ] Language persists across sessions
- [ ] Dates/numbers formatted correctly
- [ ] RTL not needed (Romanian/English both LTR)

### Push Notifications
- [ ] Permission request works
- [ ] Notifications appear correctly
- [ ] Clicking notification opens app
- [ ] Unsubscribe works

### Casting
- [ ] Devices discovered correctly
- [ ] Playback starts on TV
- [ ] Controls work (play, pause, seek)
- [ ] Disconnect handled gracefully
