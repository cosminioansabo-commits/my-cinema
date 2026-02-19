import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './authStore'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || ''

export interface Profile {
  id: string
  name: string
  avatarColor: string
  avatarIcon: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<Profile[]>([])
  const activeProfile = ref<Profile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const profileCount = computed(() => profiles.value.length)

  function getAuthHeaders() {
    const authStore = useAuthStore()
    return authStore.getAuthHeader()
  }

  async function fetchProfiles() {
    isLoading.value = true
    error.value = null
    try {
      const response = await axios.get(`${API_BASE}/api/profiles`, {
        headers: getAuthHeaders()
      })
      profiles.value = response.data.profiles
    } catch (err) {
      console.error('Error fetching profiles:', err)
      error.value = 'Failed to load profiles'
    } finally {
      isLoading.value = false
    }
  }

  async function selectProfile(profileId: string): Promise<boolean> {
    const authStore = useAuthStore()
    error.value = null
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/select-profile`,
        { profileId },
        { headers: getAuthHeaders() }
      )
      authStore.updateToken(response.data.token, response.data.expiresAt, profileId)
      activeProfile.value = profiles.value.find(p => p.id === profileId) || null
      return true
    } catch (err) {
      console.error('Error selecting profile:', err)
      error.value = 'Failed to select profile'
      return false
    }
  }

  async function createProfile(name: string, avatarColor?: string, avatarIcon?: string): Promise<Profile | null> {
    error.value = null
    try {
      const response = await axios.post(
        `${API_BASE}/api/profiles`,
        { name, avatarColor, avatarIcon },
        { headers: getAuthHeaders() }
      )
      const newProfile = response.data.profile as Profile
      profiles.value.push(newProfile)
      return newProfile
    } catch (err: any) {
      console.error('Error creating profile:', err)
      error.value = err.response?.data?.error || 'Failed to create profile'
      return null
    }
  }

  async function updateProfile(id: string, data: { name?: string; avatarColor?: string; avatarIcon?: string }): Promise<Profile | null> {
    error.value = null
    try {
      const response = await axios.put(
        `${API_BASE}/api/profiles/${id}`,
        data,
        { headers: getAuthHeaders() }
      )
      const updated = response.data.profile as Profile
      const idx = profiles.value.findIndex(p => p.id === id)
      if (idx !== -1) profiles.value[idx] = updated
      if (activeProfile.value?.id === id) activeProfile.value = updated
      return updated
    } catch (err: any) {
      console.error('Error updating profile:', err)
      error.value = err.response?.data?.error || 'Failed to update profile'
      return null
    }
  }

  async function getUniqueMediaCount(id: string): Promise<{ movies: number; shows: number } | null> {
    try {
      const response = await axios.get(
        `${API_BASE}/api/profiles/${id}/unique-media`,
        { headers: getAuthHeaders() }
      )
      return response.data
    } catch {
      return null
    }
  }

  async function deleteProfile(id: string): Promise<boolean> {
    error.value = null
    try {
      await axios.delete(
        `${API_BASE}/api/profiles/${id}`,
        { headers: getAuthHeaders() }
      )
      profiles.value = profiles.value.filter(p => p.id !== id)
      if (activeProfile.value?.id === id) activeProfile.value = null
      return true
    } catch (err: any) {
      console.error('Error deleting profile:', err)
      error.value = err.response?.data?.error || 'Failed to delete profile'
      return false
    }
  }

  function setActiveFromToken() {
    const authStore = useAuthStore()
    const profileId = authStore.activeProfileId
    if (profileId && profiles.value.length > 0) {
      activeProfile.value = profiles.value.find(p => p.id === profileId) || null
    }
  }

  function clearActive() {
    activeProfile.value = null
  }

  return {
    profiles,
    activeProfile,
    isLoading,
    error,
    profileCount,
    fetchProfiles,
    selectProfile,
    createProfile,
    updateProfile,
    getUniqueMediaCount,
    deleteProfile,
    setActiveFromToken,
    clearActive
  }
})
