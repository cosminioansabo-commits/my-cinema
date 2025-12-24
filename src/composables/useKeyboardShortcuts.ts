import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  GLOBAL_SHORTCUTS,
  NAVIGATION_SHORTCUTS,
  isInputElement,
} from '@/config/keyboardShortcuts'

// Track pending key sequence (for multi-key shortcuts like 'g h')
const pendingKey = ref<string | null>(null)
const pendingTimeout = ref<number | null>(null)

// Modal visibility state (shared across app)
export const showKeyboardHelp = ref(false)

export function useKeyboardShortcuts() {
  const router = useRouter()

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in inputs
    if (isInputElement(document.activeElement)) {
      // Allow Escape to blur inputs
      if (e.key === 'Escape') {
        ;(document.activeElement as HTMLElement)?.blur()
      }
      return
    }

    // Check for key sequence (e.g., 'g h')
    if (pendingKey.value) {
      const sequence = `${pendingKey.value} ${e.key}`
      clearPendingKey()

      // Check navigation shortcuts
      const navShortcut = NAVIGATION_SHORTCUTS[sequence]
      if (navShortcut) {
        e.preventDefault()
        handleNavigationAction(navShortcut.action)
        return
      }
    }

    // Check for sequence starter (single 'g' for navigation)
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setPendingKey('g')
      return
    }

    // Check global shortcuts
    const globalShortcut = GLOBAL_SHORTCUTS[e.key]
    if (globalShortcut) {
      e.preventDefault()
      handleGlobalAction(globalShortcut.action)
      return
    }

    // Handle ? for help (requires shift)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault()
      showKeyboardHelp.value = true
      return
    }
  }

  const setPendingKey = (key: string) => {
    pendingKey.value = key
    // Clear pending key after 1 second
    pendingTimeout.value = window.setTimeout(() => {
      pendingKey.value = null
    }, 1000)
  }

  const clearPendingKey = () => {
    pendingKey.value = null
    if (pendingTimeout.value) {
      clearTimeout(pendingTimeout.value)
      pendingTimeout.value = null
    }
  }

  const handleGlobalAction = (action: string) => {
    switch (action) {
      case 'focusSearch':
        // Focus the search input, or navigate to search page first
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
        if (searchInput) {
          searchInput.focus()
        } else {
          // Navigate to search page
          router.push('/search')
        }
        break
      case 'closeModal':
        // Close any open modal or menu
        showKeyboardHelp.value = false
        // Emit a global close event that modals can listen to
        document.dispatchEvent(new CustomEvent('keyboard:closeModal'))
        break
      case 'showHelp':
        showKeyboardHelp.value = true
        break
    }
  }

  const handleNavigationAction = (action: string) => {
    switch (action) {
      case 'goHome':
        router.push('/')
        break
      case 'goBrowse':
        router.push('/browse')
        break
      case 'goDownloads':
        router.push('/downloads')
        break
      case 'goLibrary':
        router.push('/my-library')
        break
      case 'goCalendar':
        router.push('/calendar')
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
    clearPendingKey()
  })

  return {
    pendingKey,
    showKeyboardHelp,
  }
}

// Composable for video player specific shortcuts
export function usePlayerKeyboardShortcuts(handlers: {
  togglePlay: () => void
  toggleFullscreen: () => void
  toggleMute: () => void
  seekBackward: (seconds?: number) => void
  seekForward: (seconds?: number) => void
  volumeUp: () => void
  volumeDown: () => void
  seekToPercent: (percent: number) => void
  previousFrame?: () => void
  nextFrame?: () => void
  decreaseSpeed?: () => void
  increaseSpeed?: () => void
  toggleSubtitles?: () => void
  cycleSubtitles?: () => void
  cycleAudio?: () => void
  close?: () => void
}) {
  const handleKeydown = (e: KeyboardEvent) => {
    // Don't handle if in input
    if (isInputElement(document.activeElement)) return

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        handlers.togglePlay()
        break
      case 'f':
        e.preventDefault()
        handlers.toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        handlers.toggleMute()
        break
      case 'ArrowLeft':
      case 'j':
        e.preventDefault()
        handlers.seekBackward(10)
        break
      case 'ArrowRight':
      case 'l':
        e.preventDefault()
        handlers.seekForward(10)
        break
      case 'ArrowUp':
        e.preventDefault()
        handlers.volumeUp()
        break
      case 'ArrowDown':
        e.preventDefault()
        handlers.volumeDown()
        break
      case ',':
        e.preventDefault()
        handlers.previousFrame?.()
        break
      case '.':
        e.preventDefault()
        handlers.nextFrame?.()
        break
      case '<':
        e.preventDefault()
        handlers.decreaseSpeed?.()
        break
      case '>':
        e.preventDefault()
        handlers.increaseSpeed?.()
        break
      case 'c':
        e.preventDefault()
        handlers.toggleSubtitles?.()
        break
      case 's':
        e.preventDefault()
        handlers.cycleSubtitles?.()
        break
      case 'a':
        e.preventDefault()
        handlers.cycleAudio?.()
        break
      case 'Escape':
        // Only close if not fullscreen (fullscreen exit is handled by browser)
        if (!document.fullscreenElement) {
          e.preventDefault()
          handlers.close?.()
        }
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
        handlers.seekToPercent(parseInt(e.key) * 10)
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
