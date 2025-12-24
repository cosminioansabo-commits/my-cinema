import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface UseCarouselScrollOptions {
  cardWidth?: number
  scrollMultiplier?: number
}

export function useCarouselScroll(options: UseCarouselScrollOptions = {}) {
  const { cardWidth = 180, scrollMultiplier = 4 } = options

  const trackRef = ref<HTMLElement>()
  const canScrollLeft = ref(false)
  const canScrollRight = ref(true)
  const isMobile = ref(false)

  const cardStyle = computed(() => ({
    width: isMobile.value ? '130px' : `${cardWidth}px`,
  }))

  const updateScrollButtons = () => {
    if (!trackRef.value) return

    const { scrollLeft, scrollWidth, clientWidth } = trackRef.value
    canScrollLeft.value = scrollLeft > 0
    canScrollRight.value = scrollLeft + clientWidth < scrollWidth - 10
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!trackRef.value) return

    const scrollAmount = cardWidth * scrollMultiplier
    const newPosition = direction === 'left'
      ? trackRef.value.scrollLeft - scrollAmount
      : trackRef.value.scrollLeft + scrollAmount

    trackRef.value.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    })
  }

  const checkMobile = () => {
    isMobile.value = window.innerWidth < 640
  }

  onMounted(() => {
    if (trackRef.value) {
      trackRef.value.addEventListener('scroll', updateScrollButtons)
      updateScrollButtons()
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
  })

  onUnmounted(() => {
    if (trackRef.value) {
      trackRef.value.removeEventListener('scroll', updateScrollButtons)
    }
    window.removeEventListener('resize', checkMobile)
  })

  return {
    trackRef,
    canScrollLeft,
    canScrollRight,
    isMobile,
    cardStyle,
    scroll,
    updateScrollButtons,
  }
}
