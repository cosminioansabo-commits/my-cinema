import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import router from '@/router'

export function setupAuthInterceptor(axiosInstance: AxiosInstance): void {
  // Request interceptor - add auth token to requests
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const authStore = useAuthStore()

      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`
      }

      return config
    },
    (error) => Promise.reject(error)
  )

  // Response interceptor - handle 401 errors
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        const authStore = useAuthStore()

        // Clear auth state and redirect to login
        authStore.logout()
        router.push({ name: 'login' })
      }

      return Promise.reject(error)
    }
  )
}
