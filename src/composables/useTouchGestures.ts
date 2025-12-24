import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export interface TouchGestureHandlers {
  onDoubleTapLeft?: () => void
  onDoubleTapRight?: () => void
  onDoubleTapCenter?: () => void
  onSwipeHorizontal?: (deltaX: number, velocity: number) => void
  onSwipeVerticalLeft?: (deltaY: number, velocity: number) => void
  onSwipeVerticalRight?: (deltaY: number, velocity: number) => void
  onTap?: () => void
  onPinch?: (scale: number) => void
}

export interface GestureState {
  isSeeking: boolean
  seekDelta: number
  isAdjustingBrightness: boolean
  isAdjustingVolume: boolean
  adjustmentDelta: number
}

const DOUBLE_TAP_DELAY = 300
const SWIPE_THRESHOLD = 30
const TAP_THRESHOLD = 10

export function useTouchGestures(
  elementRef: Ref<HTMLElement | null>,
  handlers: TouchGestureHandlers
) {
  const gestureState = ref<GestureState>({
    isSeeking: false,
    seekDelta: 0,
    isAdjustingBrightness: false,
    isAdjustingVolume: false,
    adjustmentDelta: 0,
  })

  let touchStartX = 0
  let touchStartY = 0
  let touchStartTime = 0
  let lastTapTime = 0
  let lastTapX = 0
  let lastTapY = 0
  let isSwiping = false
  let swipeDirection: 'horizontal' | 'vertical' | null = null

  const getTouchPosition = (e: TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0]
    return { x: touch.clientX, y: touch.clientY }
  }

  const getElementZone = (x: number, element: HTMLElement): 'left' | 'center' | 'right' => {
    const rect = element.getBoundingClientRect()
    const relativeX = x - rect.left
    const width = rect.width
    const zoneWidth = width / 3

    if (relativeX < zoneWidth) return 'left'
    if (relativeX > width - zoneWidth) return 'right'
    return 'center'
  }

  const handleTouchStart = (e: TouchEvent) => {
    const { x, y } = getTouchPosition(e)
    touchStartX = x
    touchStartY = y
    touchStartTime = Date.now()
    isSwiping = false
    swipeDirection = null

    gestureState.value = {
      isSeeking: false,
      seekDelta: 0,
      isAdjustingBrightness: false,
      isAdjustingVolume: false,
      adjustmentDelta: 0,
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!elementRef.value) return

    const { x, y } = getTouchPosition(e)
    const deltaX = x - touchStartX
    const deltaY = y - touchStartY
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Determine swipe direction if not already set
    if (!swipeDirection && (absDeltaX > SWIPE_THRESHOLD || absDeltaY > SWIPE_THRESHOLD)) {
      swipeDirection = absDeltaX > absDeltaY ? 'horizontal' : 'vertical'
      isSwiping = true
    }

    if (!isSwiping) return

    if (swipeDirection === 'horizontal') {
      // Horizontal swipe - seeking
      gestureState.value.isSeeking = true
      gestureState.value.seekDelta = deltaX
      e.preventDefault()
    } else if (swipeDirection === 'vertical') {
      // Vertical swipe - brightness (left side) or volume (right side)
      const zone = getElementZone(touchStartX, elementRef.value)

      if (zone === 'left') {
        gestureState.value.isAdjustingBrightness = true
        gestureState.value.adjustmentDelta = -deltaY // Invert for natural feel
      } else if (zone === 'right') {
        gestureState.value.isAdjustingVolume = true
        gestureState.value.adjustmentDelta = -deltaY // Invert for natural feel
      }
      e.preventDefault()
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (!elementRef.value) return

    const { x, y } = getTouchPosition(e)
    const deltaX = x - touchStartX
    const deltaY = y - touchStartY
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)
    const duration = Date.now() - touchStartTime
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / duration

    // Check for swipe gestures
    if (isSwiping) {
      if (swipeDirection === 'horizontal' && handlers.onSwipeHorizontal) {
        handlers.onSwipeHorizontal(deltaX, velocity)
      } else if (swipeDirection === 'vertical') {
        const zone = getElementZone(touchStartX, elementRef.value)
        if (zone === 'left' && handlers.onSwipeVerticalLeft) {
          handlers.onSwipeVerticalLeft(-deltaY, velocity)
        } else if (zone === 'right' && handlers.onSwipeVerticalRight) {
          handlers.onSwipeVerticalRight(-deltaY, velocity)
        }
      }
    } else if (absDeltaX < TAP_THRESHOLD && absDeltaY < TAP_THRESHOLD) {
      // Check for tap/double-tap
      const now = Date.now()
      const timeSinceLastTap = now - lastTapTime
      const distanceFromLastTap = Math.sqrt(
        Math.pow(x - lastTapX, 2) + Math.pow(y - lastTapY, 2)
      )

      if (timeSinceLastTap < DOUBLE_TAP_DELAY && distanceFromLastTap < 50) {
        // Double tap
        const zone = getElementZone(x, elementRef.value)
        if (zone === 'left' && handlers.onDoubleTapLeft) {
          handlers.onDoubleTapLeft()
        } else if (zone === 'right' && handlers.onDoubleTapRight) {
          handlers.onDoubleTapRight()
        } else if (zone === 'center' && handlers.onDoubleTapCenter) {
          handlers.onDoubleTapCenter()
        }
        lastTapTime = 0 // Reset to prevent triple-tap
      } else {
        // Single tap - delay to check for double tap
        lastTapTime = now
        lastTapX = x
        lastTapY = y

        setTimeout(() => {
          if (Date.now() - lastTapTime >= DOUBLE_TAP_DELAY && handlers.onTap) {
            handlers.onTap()
          }
        }, DOUBLE_TAP_DELAY)
      }
    }

    // Reset gesture state
    gestureState.value = {
      isSeeking: false,
      seekDelta: 0,
      isAdjustingBrightness: false,
      isAdjustingVolume: false,
      adjustmentDelta: 0,
    }
  }

  onMounted(() => {
    const element = elementRef.value
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const element = elementRef.value
    if (!element) return

    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchmove', handleTouchMove)
    element.removeEventListener('touchend', handleTouchEnd)
  })

  return {
    gestureState,
  }
}
