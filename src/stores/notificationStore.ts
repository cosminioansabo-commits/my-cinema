import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface AppNotification {
  id: string
  title: string
  body: string
  timestamp: number
  read: boolean
  type: 'download' | 'info' | 'error'
}

const STORAGE_KEY = 'my-cinema-notifications'
const MAX_NOTIFICATIONS = 50

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])

  // Load from localStorage
  const loadNotifications = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        notifications.value = JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load notifications:', e)
    }
  }

  // Save to localStorage
  const saveNotifications = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.value))
    } catch (e) {
      console.error('Failed to save notifications:', e)
    }
  }

  // Add a new notification
  const addNotification = (title: string, body: string, type: AppNotification['type'] = 'info') => {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      type
    }

    notifications.value.unshift(notification)

    // Keep only the latest notifications
    if (notifications.value.length > MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS)
    }

    saveNotifications()
    return notification
  }

  // Mark notification as read
  const markAsRead = (id: string) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
      saveNotifications()
    }
  }

  // Mark all as read
  const markAllAsRead = () => {
    notifications.value.forEach(n => n.read = true)
    saveNotifications()
  }

  // Clear all notifications
  const clearAll = () => {
    notifications.value = []
    saveNotifications()
  }

  // Delete a specific notification
  const deleteNotification = (id: string) => {
    notifications.value = notifications.value.filter(n => n.id !== id)
    saveNotifications()
  }

  // Computed: unread count
  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

  // Initialize on store creation
  loadNotifications()

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteNotification
  }
})
