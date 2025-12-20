import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Global state - shared across all components
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canInstall = ref(false)
const isInstalled = ref(false)
const showInstallButton = ref(false) // Show button even before prompt is ready

// Check if already installed
const checkIfInstalled = () => {
  if (typeof window === 'undefined') return

  // Check if running as installed PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isInstalled.value = true
    canInstall.value = false
    return true
  }
  // Check for iOS standalone mode
  if ((navigator as { standalone?: boolean }).standalone === true) {
    isInstalled.value = true
    canInstall.value = false
    return true
  }
  return false
}

// Check if browser supports PWA installation
const isPWASupported = () => {
  if (typeof window === 'undefined') return false
  // Chrome, Edge, Opera, Samsung Internet support beforeinstallprompt
  const isChromium = 'chrome' in window || /Chrome|Chromium|Edg|OPR|Samsung/i.test(navigator.userAgent)
  // Also check for standalone display mode support
  const supportsStandalone = window.matchMedia('(display-mode: standalone)').media !== 'not all'
  return isChromium && supportsStandalone
}

// Initialize PWA install handling
const initPWAInstall = () => {
  if (typeof window === 'undefined') return

  // Check if already installed
  if (checkIfInstalled()) {
    console.log('PWA: Already installed')
    return
  }

  // Show install button if browser supports PWA (even before prompt fires)
  if (isPWASupported()) {
    showInstallButton.value = true
    console.log('PWA: Browser supports installation')
  }

  console.log('PWA: Initializing install handler')

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault()
    // Store the event so it can be triggered later
    deferredPrompt.value = e as BeforeInstallPromptEvent
    canInstall.value = true
    console.log('PWA: Install prompt available')
  })

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    canInstall.value = false
    isInstalled.value = true
    console.log('PWA: Installed successfully')
  })

  // Check if getInstalledRelatedApps is available (Chrome 80+)
  if ('getInstalledRelatedApps' in navigator) {
    (navigator as { getInstalledRelatedApps: () => Promise<{ platform: string }[]> })
      .getInstalledRelatedApps()
      .then((apps) => {
        if (apps.length > 0) {
          isInstalled.value = true
          canInstall.value = false
          console.log('PWA: Found installed related apps', apps)
        }
      })
      .catch(() => {})
  }
}

// Run initialization
initPWAInstall()

export function usePWAInstall() {
  const installPWA = async (): Promise<boolean | 'manual'> => {
    if (!deferredPrompt.value) {
      console.log('PWA: No install prompt available yet, user needs manual install')
      // Return 'manual' to indicate manual installation is needed
      return 'manual'
    }

    // Show the install prompt
    await deferredPrompt.value.prompt()

    // Wait for the user's response
    const { outcome } = await deferredPrompt.value.userChoice
    console.log('PWA install outcome:', outcome)

    // Clear the deferred prompt
    deferredPrompt.value = null
    canInstall.value = false

    return outcome === 'accepted'
  }

  return {
    canInstall,
    showInstallButton,
    isInstalled,
    installPWA
  }
}
