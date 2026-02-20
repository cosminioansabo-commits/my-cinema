import { ref, watch, onUnmounted, type Ref } from 'vue'

export function useInfiniteScroll(
  sentinel: Ref<HTMLElement | null>,
  loadMore: () => void | Promise<void>
) {
  const enabled = ref(true)
  let observer: IntersectionObserver | null = null

  function createObserver(el: HTMLElement) {
    observer?.disconnect()
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && enabled.value) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
  }

  watch(sentinel, (el) => {
    if (el) createObserver(el)
    else observer?.disconnect()
  })

  function pause() {
    enabled.value = false
  }

  function resume() {
    enabled.value = true
  }

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { pause, resume }
}
