<script setup lang="ts">
import { useLanguage } from '@/composables/useLanguage'

const { locale, setLocale } = useLanguage()

const toggleLanguage = () => {
  setLocale(locale.value === 'en' ? 'ro' : 'en')
}
</script>

<template>
  <button
    @click="toggleLanguage"
    class="language-toggle flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition-colors"
    :title="locale === 'en' ? 'Switch to Romanian' : 'Switch to English'"
  >
    <span v-if="locale === 'en'" class="text-lg">🇬🇧</span>
    <span v-else class="text-lg">🇷🇴</span>
  </button>
</template>
