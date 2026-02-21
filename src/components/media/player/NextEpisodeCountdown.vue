<script setup lang="ts">
import Button from 'primevue/button'
import { useLanguage } from '@/composables/useLanguage'

const { t } = useLanguage()

defineProps<{
  seasonNumber: number
  episodeNumber: number
  name: string
  overview?: string
  countdownSeconds: number
}>()

const emit = defineEmits<{
  cancel: []
  playNow: []
}>()
</script>

<template>
  <div class="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
    <div class="text-center max-w-lg px-6">
      <p class="text-gray-400 text-sm uppercase tracking-wide mb-2">{{ t('player.upNext') }}</p>
      <h3 class="text-white text-2xl font-bold mb-2">
        S{{ seasonNumber }}:E{{ episodeNumber }} - {{ name }}
      </h3>
      <p v-if="overview" class="text-gray-400 text-sm line-clamp-2 mb-6">
        {{ overview }}
      </p>

      <!-- Countdown ring -->
      <div class="relative w-24 h-24 mx-auto mb-6">
        <svg class="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="#333"
            stroke-width="4"
          />
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="#e50914"
            stroke-width="4"
            stroke-linecap="round"
            :stroke-dasharray="276.46"
            :stroke-dashoffset="276.46 * (1 - countdownSeconds / 10)"
            class="transition-all duration-1000"
          />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold">
          {{ countdownSeconds }}
        </span>
      </div>

      <div class="flex gap-4 justify-center">
        <Button
          :label="t('player.cancelAutoplay')"
          severity="secondary"
          class="!bg-zinc-700 !border-0 hover:!bg-zinc-600"
          @click="emit('cancel')"
        />
        <Button
          :label="t('player.playNow')"
          class="!bg-[#e50914] !border-0 hover:!bg-[#f40612]"
          @click="emit('playNow')"
        />
      </div>
    </div>
  </div>
</template>
