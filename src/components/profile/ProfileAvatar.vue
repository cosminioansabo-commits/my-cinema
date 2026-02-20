<script setup lang="ts">
import { computed } from 'vue'
import { getAvatarBackgroundStyle, getPrimaryColor, getIconDisplay } from '@/config/avatarOptions'

const props = withDefaults(
  defineProps<{
    color: string
    icon: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    animated?: boolean
    glow?: boolean
  }>(),
  {
    size: 'md',
    animated: false,
    glow: true,
  }
)

const sizeMap = {
  xs: { container: 'w-8 h-8 rounded-lg', pi: 'text-sm', emoji: 'text-base' },
  sm: { container: 'w-12 h-12 rounded-xl', pi: 'text-lg', emoji: 'text-xl' },
  md: { container: 'w-20 h-20 rounded-2xl', pi: 'text-3xl', emoji: 'text-4xl' },
  lg: { container: 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl', pi: 'text-4xl sm:text-5xl', emoji: 'text-5xl sm:text-6xl' },
  xl: { container: 'w-32 h-32 rounded-3xl', pi: 'text-5xl', emoji: 'text-6xl' },
}

const bgStyle = computed(() => {
  const base = getAvatarBackgroundStyle(props.color)
  if (props.glow) {
    return { ...base, boxShadow: `0 8px 24px ${getPrimaryColor(props.color)}30` }
  }
  return base
})

const iconDisplay = computed(() => getIconDisplay(props.icon))
const classes = computed(() => sizeMap[props.size])
</script>

<template>
  <div
    class="flex items-center justify-center ring-1 ring-white/10 transition-all duration-300"
    :class="[classes.container, animated ? 'avatar-bounce' : '']"
    :style="bgStyle"
  >
    <i
      v-if="iconDisplay.type === 'pi'"
      :class="['pi', iconDisplay.content, classes.pi, 'text-white drop-shadow-sm']"
    />
    <span v-else :class="[classes.emoji, 'drop-shadow-sm select-none leading-none']">
      {{ iconDisplay.content }}
    </span>
  </div>
</template>

<style scoped>
.avatar-bounce {
  animation: avatar-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes avatar-pop {
  0% { transform: scale(0.85); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
</style>
