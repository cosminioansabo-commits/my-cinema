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

// Set up event listeners immediately when module loads
if (typeof window !== 'undefined') {
  // Check if already installed
  checkIfInstalled()

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault()
    // Store the event so it can be triggered later
    deferredPrompt.value = e as BeforeInstallPromptEvent
    canInstall.value = true
    console.log('PWA install prompt available')
  })

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    canInstall.value = false
    isInstalled.value = true
    console.log('PWA installed successfully')
  })
}

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
