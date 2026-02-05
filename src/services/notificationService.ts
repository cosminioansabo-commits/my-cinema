export const APP_NOTIFICATION_EVENT = 'app-notification'

const notificationService = {
  isNativeSupported(): boolean {
    return 'Notification' in window && window.isSecureContext
  },

  async requestPermission(): Promise<boolean> {
    if (!this.isNativeSupported()) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  },

  async show(title: string, body: string, icon?: string): Promise<void> {
    // Try service worker notification (produces real phone notifications in PWA)
    if (this.isNativeSupported() && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          body,
          icon: icon || '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        })
        return
      } catch {
        // Fall through to toast fallback
      }
    }

    // Fallback: dispatch custom event for in-app toast
    window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, {
      detail: { title, body }
    }))
  }
}

export default notificationService
