import { useNotificationStore } from '@/stores/notificationStore'

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

  async show(title: string, body: string, icon?: string, type: 'download' | 'info' | 'error' = 'info'): Promise<void> {
    // Store notification in the notification center
    try {
      const notificationStore = useNotificationStore()
      notificationStore.addNotification(title, body, type)
    } catch (e) {
      // Store might not be initialized yet
      console.debug('[Notification] Could not store notification:', e)
    }

    console.debug('[Notification] show() called', {
      title,
      body,
      isNativeSupported: this.isNativeSupported(),
      permission: 'Notification' in window ? Notification.permission : 'N/A',
      hasServiceWorker: 'serviceWorker' in navigator,
      isSecureContext: window.isSecureContext
    })

    // Try service worker notification (produces real phone notifications in PWA)
    if (this.isNativeSupported() && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        console.debug('[Notification] Attempting SW notification...')
        const registration = await navigator.serviceWorker.ready
        console.debug('[Notification] SW ready, calling showNotification')
        await registration.showNotification(title, {
          body,
          icon: icon || '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        })
        console.debug('[Notification] SW showNotification succeeded')
        return
      } catch (err) {
        console.error('[Notification] SW notification failed:', err)
        // Fall through to toast fallback
      }
    }

    // Fallback: dispatch custom event for in-app toast
    console.debug('[Notification] Using toast fallback')
    window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, {
      detail: { title, body }
    }))
  }
}

export default notificationService
