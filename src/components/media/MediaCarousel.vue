<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import type { Media } from '@/types'
import MediaCard from './MediaCard.vue'
import Skeleton from 'primevue/skeleton'

const props = withDefaults(defineProps<{
  title: string
  items: Media[]
  loading?: boolean
  seeAllLink?: string
  cardWidth?: number
}>(), {
  cardWidth: 180,
})

const trackRef = ref<HTMLElement>()
const canScrollLeft = ref(false)
const canScrollRight = ref(true)

const cardStyle = computed(() => ({
  width: `${props.cardWidth}px`,
}))

const updateScrollButtons = () => {
  if (!trackRef.value) return

  const { scrollLeft, scrollWidth, clientWidth } = trackRef.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft + clientWidth < scrollWidth - 10
}

const scroll = (direction: 'left' | 'right') => {
  if (!trackRef.value) return

  const scrollAmount = props.cardWidth * 4
  const newPosition = direction === 'left'
    ? trackRef.value.scrollLeft - scrollAmount
    : trackRef.value.scrollLeft + scrollAmount

  trackRef.value.scrollTo({
    left: newPosition,
    behavior: 'smooth',
  })
}

onMounted(() => {
  if (trackRef.value) {
    trackRef.value.addEventListener('scroll', updateScrollButtons)
    updateScrollButtons()
  }
})

onUnmounted(() => {
  if (trackRef.value) {
    trackRef.value.removeEventListener('scroll', updateScrollButtons)
  }
})
</script>

<template>
  <section class="carousel-section mb-10">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4 px-4 md:px-12">
      <component
        :is="seeAllLink ? RouterLink : 'h2'"
        :to="seeAllLink"
        class="row-title group flex items-center gap-3"
      >
        {{ title }}
        <span v-if="seeAllLink" class="text-sm font-normal text-[#e50914] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          See all
          <i class="pi pi-chevron-right text-xs"></i>
        </span>
      </component>
    </div>

    <!-- Carousel -->
    <div class="carousel-container group">
      <!-- Left Arrow -->
      <button
        v-show="canScrollLeft && !loading"
        class="carousel-btn carousel-btn-left"
        @click="scroll('left')"
        aria-label="Scroll left"
      >
        <i class="pi pi-chevron-left"></i>
      </button>

      <!-- Track -->
      <div
        ref="trackRef"
        class="carousel-track px-4 md:px-12"
      >
        <!-- Loading skeletons with better styling -->
        <template v-if="loading">
          <div
            v-for="i in 8"
            :key="`skeleton-${i}`"
            class="carousel-item"
            :style="cardStyle"
          >
            <div class="bg-[#181818] rounded-xl overflow-hidden shadow-lg shadow-black/30 border border-zinc-800/50 animate-pulse">
              <div class="aspect-[2/3] bg-zinc-800"></div>
            </div>
          </div>
        </template>

        <!-- Media cards -->
        <template v-else>
          <div
            v-for="item in items"
            :key="`${item.mediaType}-${item.id}`"
            class="carousel-item"
            :style="cardStyle"
          >
            <MediaCard :media="item" variant="compact" />
          </div>
        </template>
      </div>

      <!-- Right Arrow -->
      <button
        v-show="canScrollRight && !loading"
        class="carousel-btn carousel-btn-right"
        @click="scroll('right')"
        aria-label="Scroll right"
      >
        <i class="pi pi-chevron-right"></i>
      </button>
    </div>
  </section>
</template>
