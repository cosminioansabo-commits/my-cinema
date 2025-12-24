import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n'
import { setTmdbLanguage } from '@/services/tmdbService'

const STORAGE_KEY = 'my-cinema-locale'

// Global reactive flag to trigger refetch across components
const languageChangeCounter = ref(0)

export function useLanguage() {
  const { locale, t } = useI18n()

  const currentLocale = computed({
    get: () => locale.value as SupportedLocale,
    set: (value: SupportedLocale) => {
      locale.value = value
    },
  })

  const currentLocaleName = computed(() => {
    const found = SUPPORTED_LOCALES.find(l => l.code === currentLocale.value)
    return found?.nativeName || currentLocale.value
  })

  const setLocale = (newLocale: SupportedLocale) => {
    const previousLocale = locale.value
    locale.value = newLocale
    localStorage.setItem(STORAGE_KEY, newLocale)
    document.documentElement.lang = newLocale
    // Update TMDB language for API requests
    setTmdbLanguage(newLocale)
    // Trigger refetch if locale actually changed
    if (previousLocale !== newLocale) {
      languageChangeCounter.value++
    }
  }

  const toggleLocale = () => {
    const currentIndex = SUPPORTED_LOCALES.findIndex(l => l.code === currentLocale.value)
    const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length
    setLocale(SUPPORTED_LOCALES[nextIndex].code)
  }

  // Keep document lang attribute in sync and update TMDB language
  watch(
    locale,
    (newLocale) => {
      document.documentElement.lang = newLocale
      localStorage.setItem(STORAGE_KEY, newLocale)
      setTmdbLanguage(newLocale)
    },
    { immediate: true }
  )

  return {
    t,
    locale: currentLocale,
    currentLocaleName,
    supportedLocales: SUPPORTED_LOCALES,
    setLocale,
    toggleLocale,
    languageChangeCounter,
  }
}
