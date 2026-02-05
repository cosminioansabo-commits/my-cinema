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

  show(title: string, body: string, icon?: string): void {
    // Try native notification first (HTTPS/localhost only)
    if (this.isNativeSupported() && Notification.permission === 'granted') {
      new Notification(title, { body, icon: icon || '/pwa-192x192.png', badge: '/pwa-192x192.png' })
      return
    }

    // Fallback: dispatch custom event for in-app toast
    window.dispatchEvent(new CustomEvent(APP_NOTIFICATION_EVENT, {
      detail: { title, body }
    }))
  }
}

export default notificationService
