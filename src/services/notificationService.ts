const notificationService = {
  isSupported(): boolean {
    return 'Notification' in window
  },

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  },

  show(title: string, body: string, icon?: string): void {
    if (!this.isSupported() || Notification.permission !== 'granted') return
    new Notification(title, { body, icon: icon || '/pwa-192x192.png', badge: '/pwa-192x192.png' })
  }
}

export default notificationService
