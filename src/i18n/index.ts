import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import ro from './locales/ro.json'

// Get saved locale from localStorage or default to English
const savedLocale = localStorage.getItem('my-cinema-locale') || 'en'

export const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    ro,
  },
})

export type SupportedLocale = 'en' | 'ro'

export const SUPPORTED_LOCALES: { code: SupportedLocale; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
]
