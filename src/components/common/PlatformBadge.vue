<script setup lang="ts">
import { computed } from 'vue'
import { getImageUrl } from '@/services/tmdbService'

const props = defineProps<{
  logoPath: string
  name: string
  size?: 'sm' | 'md' | 'lg'
}>()

const logoUrl = computed(() => getImageUrl(props.logoPath, 'w200'))

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-6 h-6'
    case 'lg':
      return 'w-12 h-12'
    default:
      return 'w-8 h-8'
  }
})
</script>

<template>
  <div
    class="rounded-lg overflow-hidden bg-zinc-800"
    :class="sizeClasses"
    v-tooltip="name"
  >
    <img
      :src="logoUrl"
      :alt="name"
      class="w-full h-full object-cover"
    />
  </div>
</template>
