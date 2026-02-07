<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  progress: number // 0-100
  size?: number // diameter in pixels
  strokeWidth?: number
  showPercentage?: boolean
  color?: string
  trackColor?: string
}>(), {
  size: 48,
  strokeWidth: 4,
  showPercentage: true,
  color: '#3b82f6', // blue-500
  trackColor: '#3f3f46', // zinc-700
})

const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const strokeDashoffset = computed(() => {
  const clampedProgress = Math.min(100, Math.max(0, props.progress))
  return circumference.value - (clampedProgress / 100) * circumference.value
})

const center = computed(() => props.size / 2)

const displayProgress = computed(() => {
  if (props.progress < 1) {
    return props.progress.toFixed(1)
  }
  return Math.round(props.progress)
})
</script>

<template>
  <div class="circular-progress" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" class="transform -rotate-90">
      <!-- Background track -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke="trackColor"
        :stroke-width="strokeWidth"
        fill="none"
      />
      <!-- Progress arc -->
      <circle
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke="color"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        stroke-linecap="round"
        fill="none"
        class="transition-all duration-300"
      />
    </svg>
    <!-- Percentage text -->
    <div v-if="showPercentage" class="absolute inset-0 flex items-center justify-center">
      <span class="text-xs font-medium text-white">{{ displayProgress }}%</span>
    </div>
  </div>
</template>

<style scoped>
.circular-progress {
  position: relative;
  display: inline-flex;
}
</style>
