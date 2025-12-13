import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_TORRENT_API_URL || 'http://localhost:3001'
const TOKEN_KEY = 'my-cinema-auth-token'
const EXPIRES_KEY = 'my-cinema-auth-expires'

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const expiresAt = ref<number | null>(
    localStorage.getItem(EXPIRES_KEY) ? parseInt(localStorage.getItem(EXPIRES_KEY)!) : null
  )
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const authEnabled = ref<boolean | null>(null) // null = not yet checked

  // Getters
  const isAuthenticated = computed(() => {
    if (!token.value || !expiresAt.value) return false
    // Check if token is expired
    return Date.now() < expiresAt.value
  })

  const tokenExpiresIn = computed(() => {
    if (!expiresAt.value) return 0
    return Math.max(0, expiresAt.value - Date.now())
  })

  // Actions
  async function checkAuthStatus(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_BASE}/api/auth/status`)
      authEnabled.value = response.data.authEnabled
      return response.data.authEnabled
    } catch {
      // If we can't reach the server, assume auth is enabled for safety
      authEnabled.value = true
      return true
    }
  }

  async function login(password: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, { password })

      token.value = response.data.token
      expiresAt.value = response.data.expiresAt

      // Persist to localStorage
      localStorage.setItem(TOKEN_KEY, response.data.token)
      localStorage.setItem(EXPIRES_KEY, response.data.expiresAt.toString())

      return true
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          error.value = 'Invalid password'
        } else if (err.response?.status === 429) {
          error.value = 'Too many attempts. Please wait a minute.'
        } else {
          error.value = err.response?.data?.error || 'Login failed'
        }
      } else {
        error.value = 'Connection failed'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function verifyToken(): Promise<boolean> {
    if (!token.value) return false

    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/verify`,
        {},
        { headers: { Authorization: `Bearer ${token.value}` } }
      )
      return response.data.valid
    } catch {
      return false
    }
  }

  function logout() {
    token.value = null
    expiresAt.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }

  function getAuthHeader(): { Authorization: string } | {} {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  // Initialize: Check if current token is still valid
  async function initialize(): Promise<void> {
    // First check if auth is enabled
    await checkAuthStatus()

    // If auth is not enabled, we're good
    if (!authEnabled.value) return

    // If we have a token, verify it's still valid
    if (token.value) {
      const isValid = await verifyToken()
      if (!isValid) {
        logout()
      }
    }
  }

  return {
    // State
    token,
    expiresAt,
    isLoading,
    error,
    authEnabled,
    // Getters
    isAuthenticated,
    tokenExpiresIn,
    // Actions
    checkAuthStatus,
    login,
    verifyToken,
    logout,
    getAuthHeader,
    initialize
  }
})
