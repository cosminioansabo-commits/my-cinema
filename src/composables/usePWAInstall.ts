import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Global state - shared across all components
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canInstall = ref(false)
const isInstalled = ref(false)

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

// Initialize PWA install handling
const initPWAInstall = () => {
  if (typeof window === 'undefined') return

  // Check if already installed
  if (checkIfInstalled()) {
    console.log('PWA: Already installed')
    return
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
  const installPWA = async () => {
    if (!deferredPrompt.value) {
      console.log('No install prompt available')
      return false
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
    isInstalled,
    installPWA
  }
}
