// Keyboard shortcuts configuration
// Supports single keys and key sequences (e.g., 'g h' for go home)

export interface ShortcutAction {
  action: string
  description: string
  key: string
}

export interface ShortcutGroup {
  name: string
  shortcuts: ShortcutAction[]
}

// Global shortcuts - work everywhere except when typing in inputs
export const GLOBAL_SHORTCUTS: Record<string, ShortcutAction> = {
  '/': { action: 'focusSearch', description: 'Open search', key: '/ / \u2318K' },
  'Escape': { action: 'closeModal', description: 'Close modal/menu', key: 'Esc' },
  '?': { action: 'showHelp', description: 'Show keyboard shortcuts', key: '?' },
}

// Navigation shortcuts - use 'g' prefix for "go to"
export const NAVIGATION_SHORTCUTS: Record<string, ShortcutAction> = {
  'g h': { action: 'goHome', description: 'Go to Home', key: 'g h' },
  'g b': { action: 'goBrowse', description: 'Go to Browse', key: 'g b' },
  'g d': { action: 'goDownloads', description: 'Go to Downloads', key: 'g d' },
  'g l': { action: 'goLibrary', description: 'Go to My Library', key: 'g l' },
  'g c': { action: 'goCalendar', description: 'Go to Calendar', key: 'g c' },
}

// Video player shortcuts
export const PLAYER_SHORTCUTS: Record<string, ShortcutAction> = {
  ' ': { action: 'togglePlay', description: 'Play/Pause', key: 'Space' },
  'k': { action: 'togglePlay', description: 'Play/Pause', key: 'K' },
  'f': { action: 'toggleFullscreen', description: 'Toggle fullscreen', key: 'F' },
  'm': { action: 'toggleMute', description: 'Toggle mute', key: 'M' },
  'ArrowLeft': { action: 'seekBackward', description: 'Seek back 10s', key: '←' },
  'ArrowRight': { action: 'seekForward', description: 'Seek forward 10s', key: '→' },
  'j': { action: 'seekBackward', description: 'Seek back 10s', key: 'J' },
  'l': { action: 'seekForward', description: 'Seek forward 10s', key: 'L' },
  'ArrowUp': { action: 'volumeUp', description: 'Volume up', key: '↑' },
  'ArrowDown': { action: 'volumeDown', description: 'Volume down', key: '↓' },
  ',': { action: 'previousFrame', description: 'Previous frame (paused)', key: ',' },
  '.': { action: 'nextFrame', description: 'Next frame (paused)', key: '.' },
  '<': { action: 'decreaseSpeed', description: 'Decrease speed', key: '<' },
  '>': { action: 'increaseSpeed', description: 'Increase speed', key: '>' },
  'c': { action: 'toggleSubtitles', description: 'Toggle subtitles', key: 'C' },
  's': { action: 'cycleSubtitles', description: 'Cycle subtitle tracks', key: 'S' },
  'a': { action: 'cycleAudio', description: 'Cycle audio tracks', key: 'A' },
  '0': { action: 'seekTo0', description: 'Seek to 0%', key: '0' },
  '1': { action: 'seekTo10', description: 'Seek to 10%', key: '1' },
  '2': { action: 'seekTo20', description: 'Seek to 20%', key: '2' },
  '3': { action: 'seekTo30', description: 'Seek to 30%', key: '3' },
  '4': { action: 'seekTo40', description: 'Seek to 40%', key: '4' },
  '5': { action: 'seekTo50', description: 'Seek to 50%', key: '5' },
  '6': { action: 'seekTo60', description: 'Seek to 60%', key: '6' },
  '7': { action: 'seekTo70', description: 'Seek to 70%', key: '7' },
  '8': { action: 'seekTo80', description: 'Seek to 80%', key: '8' },
  '9': { action: 'seekTo90', description: 'Seek to 90%', key: '9' },
}

// Browse/Grid navigation shortcuts
export const BROWSE_SHORTCUTS: Record<string, ShortcutAction> = {
  'ArrowLeft': { action: 'prevItem', description: 'Previous item', key: '←' },
  'ArrowRight': { action: 'nextItem', description: 'Next item', key: '→' },
  'ArrowUp': { action: 'prevRow', description: 'Previous row', key: '↑' },
  'ArrowDown': { action: 'nextRow', description: 'Next row', key: '↓' },
  'Enter': { action: 'openItem', description: 'Open selected item', key: 'Enter' },
}

// Playback speed options
export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number]

// Get grouped shortcuts for help modal
export function getShortcutGroups(): ShortcutGroup[] {
  return [
    {
      name: 'General',
      shortcuts: Object.values(GLOBAL_SHORTCUTS),
    },
    {
      name: 'Navigation',
      shortcuts: Object.values(NAVIGATION_SHORTCUTS),
    },
    {
      name: 'Video Player',
      shortcuts: [
        // Deduplicate by action, prefer more intuitive key display
        { action: 'togglePlay', description: 'Play/Pause', key: 'Space / K' },
        { action: 'toggleFullscreen', description: 'Toggle fullscreen', key: 'F' },
        { action: 'toggleMute', description: 'Toggle mute', key: 'M' },
        { action: 'seekBackward', description: 'Seek back 10s', key: '← / J' },
        { action: 'seekForward', description: 'Seek forward 10s', key: '→ / L' },
        { action: 'volumeUp', description: 'Volume up', key: '↑' },
        { action: 'volumeDown', description: 'Volume down', key: '↓' },
        { action: 'previousFrame', description: 'Previous frame (paused)', key: ',' },
        { action: 'nextFrame', description: 'Next frame (paused)', key: '.' },
        { action: 'decreaseSpeed', description: 'Decrease speed', key: '<' },
        { action: 'increaseSpeed', description: 'Increase speed', key: '>' },
        { action: 'toggleSubtitles', description: 'Toggle subtitles', key: 'C' },
        { action: 'cycleSubtitles', description: 'Cycle subtitle tracks', key: 'S' },
        { action: 'cycleAudio', description: 'Cycle audio tracks', key: 'A' },
        { action: 'seekToPercent', description: 'Seek to 0-90%', key: '0-9' },
      ],
    },
  ]
}

// Check if an element is an input/textarea that should receive keyboard input
export function isInputElement(element: Element | null): boolean {
  if (!element) return false
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  )
}
