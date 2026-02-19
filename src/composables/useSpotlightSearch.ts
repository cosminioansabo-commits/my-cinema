import { ref } from 'vue'

// Shared visibility state for the Spotlight search overlay
export const spotlightVisible = ref(false)

export function openSpotlight() {
  spotlightVisible.value = true
}

export function closeSpotlight() {
  spotlightVisible.value = false
}

export function toggleSpotlight() {
  spotlightVisible.value = !spotlightVisible.value
}
