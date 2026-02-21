import { ref } from 'vue'
import type { MediaType } from '@/types'

export interface RecentlyViewedItem {
  id: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  viewedAt: number
}

const STORAGE_KEY = 'my-cinema-recently-viewed'
const MAX_ITEMS = 20

function loadFromStorage(): RecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items: RecentlyViewedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // localStorage full or unavailable
  }
}

const recentlyViewed = ref<RecentlyViewedItem[]>(loadFromStorage())

export function useRecentlyViewed() {
  function addItem(item: Omit<RecentlyViewedItem, 'viewedAt'>): void {
    // Remove existing entry for same media
    const filtered = recentlyViewed.value.filter(
      (i) => !(i.id === item.id && i.mediaType === item.mediaType)
    )

    // Add to front
    const newItem: RecentlyViewedItem = {
      ...item,
      viewedAt: Date.now(),
    }

    recentlyViewed.value = [newItem, ...filtered].slice(0, MAX_ITEMS)
    saveToStorage(recentlyViewed.value)
  }

  function removeItem(id: number, mediaType: MediaType): void {
    recentlyViewed.value = recentlyViewed.value.filter(
      (i) => !(i.id === id && i.mediaType === mediaType)
    )
    saveToStorage(recentlyViewed.value)
  }

  function clearAll(): void {
    recentlyViewed.value = []
    saveToStorage([])
  }

  return {
    recentlyViewed,
    addItem,
    removeItem,
    clearAll,
  }
}
