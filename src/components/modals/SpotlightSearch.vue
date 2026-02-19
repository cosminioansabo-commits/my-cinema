<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/mediaStore'
import { useDebounce } from '@/composables/useDebounce'
import { getImageUrl } from '@/services/tmdbService'
import { spotlightVisible, closeSpotlight } from '@/composables/useSpotlightSearch'
import Dialog from 'primevue/dialog'

const router = useRouter()
const mediaStore = useMediaStore()

const query = ref('')
const debouncedQuery = useDebounce(query, 300)
const selectedIndex = ref(-1)
const inputRef = ref<HTMLInputElement | null>(null)
const resultsRef = ref<HTMLElement | null>(null)

const results = computed(() => mediaStore.searchResults)
const isLoading = computed(() => mediaStore.isLoadingSearch)

const displayResults = computed(() =>
  results.value.map((media) => ({
    id: media.id,
    title: media.title,
    year: media.releaseDate?.substring(0, 4) || '',
    posterUrl: getImageUrl(media.posterPath, 'w200'),
    mediaType: media.mediaType,
    rating: media.voteAverage,
    route: { name: 'media-detail' as const, params: { type: media.mediaType, id: media.id } },
  }))
)

// Search when debounced query changes
watch(debouncedQuery, (val) => {
  if (val.trim()) {
    mediaStore.search(val.trim(), 1)
    selectedIndex.value = 0
  } else {
    mediaStore.clearSearch()
    selectedIndex.value = -1
  }
})

// Focus input on open, clear state on close
watch(spotlightVisible, (visible) => {
  if (visible) {
    nextTick(() => inputRef.value?.focus())
  } else {
    query.value = ''
    mediaStore.clearSearch()
    selectedIndex.value = -1
  }
})

function navigateToResult(item: (typeof displayResults.value)[0]) {
  router.push(item.route)
  closeSpotlight()
}

function handleKeydown(e: KeyboardEvent) {
  const count = displayResults.value.length

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (count > 0) {
        selectedIndex.value = Math.min(selectedIndex.value + 1, count - 1)
        scrollSelectedIntoView()
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      if (count > 0) {
        selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
        scrollSelectedIntoView()
      }
      break
    case 'Enter':
      e.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < count) {
        navigateToResult(displayResults.value[selectedIndex.value])
      }
      break
    case 'Escape':
      e.preventDefault()
      closeSpotlight()
      break
  }
}

function scrollSelectedIntoView() {
  nextTick(() => {
    const el = resultsRef.value?.children[selectedIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function ratingColor(rating: number) {
  if (rating >= 7) return 'text-green-400 bg-green-400/15'
  if (rating >= 5) return 'text-yellow-400 bg-yellow-400/15'
  return 'text-red-400 bg-red-400/15'
}
</script>

<template>
  <Dialog
    v-model:visible="spotlightVisible"
    modal
    dismissableMask
    :closable="false"
    :pt="{
      root: { class: 'spotlight-dialog' },
      mask: { class: 'spotlight-mask' },
      content: { class: 'spotlight-content' },
      header: { class: '!hidden' },
    }"
  >
    <!-- Search input area -->
    <div class="spotlight-input-area">
      <div class="flex items-center gap-3 px-5 py-4">
        <svg class="w-5 h-5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          placeholder="Search movies & TV shows..."
          class="spotlight-input"
          @keydown="handleKeydown"
        />
        <kbd
          v-if="!query"
          class="spotlight-kbd"
        >
          ESC
        </kbd>
        <button
          v-else
          class="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-700/60 text-zinc-400 hover:text-white hover:bg-zinc-600 transition-all duration-150 flex-shrink-0"
          @click="query = ''"
        >
          <i class="pi pi-times text-[10px]"></i>
        </button>
      </div>
      <!-- Gradient divider -->
      <div class="h-px bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent"></div>
    </div>

    <!-- Results list -->
    <div ref="resultsRef" class="spotlight-results">
      <!-- Loading skeletons -->
      <div v-if="isLoading && results.length === 0" class="p-3">
        <div v-for="i in 4" :key="i" class="flex items-center gap-4 px-3 py-3 animate-pulse">
          <div class="w-11 h-[66px] rounded-lg bg-zinc-800 flex-shrink-0"></div>
          <div class="flex-1 space-y-2.5">
            <div class="h-3.5 bg-zinc-800 rounded-md w-3/4"></div>
            <div class="h-2.5 bg-zinc-800/60 rounded-md w-1/2"></div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-else-if="displayResults.length > 0" class="p-2">
        <button
          v-for="(item, index) in displayResults"
          :key="`${item.mediaType}-${item.id}`"
          class="spotlight-result"
          :class="index === selectedIndex ? 'spotlight-result--active' : ''"
          @click="navigateToResult(item)"
          @mouseenter="selectedIndex = index"
        >
          <!-- Poster thumbnail -->
          <img
            :src="item.posterUrl"
            :alt="item.title"
            class="w-11 h-[66px] object-cover rounded-lg bg-zinc-800 flex-shrink-0 ring-1 ring-white/[0.08]"
          />
          <!-- Title and metadata -->
          <div class="flex-1 min-w-0">
            <p class="text-white text-[13px] font-medium truncate leading-snug">{{ item.title }}</p>
            <div class="flex items-center gap-2 mt-1">
              <span v-if="item.year" class="text-zinc-400 text-xs">{{ item.year }}</span>
              <span class="flex items-center gap-1 text-zinc-500 text-xs">
                <i :class="['pi', item.mediaType === 'tv' ? 'pi-desktop' : 'pi-video', 'text-[10px]']"></i>
                {{ item.mediaType === 'tv' ? 'TV Show' : 'Movie' }}
              </span>
            </div>
          </div>
          <!-- Rating badge -->
          <span
            v-if="item.rating > 0"
            class="flex-shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
            :class="ratingColor(item.rating)"
          >
            {{ item.rating.toFixed(1) }}
          </span>
          <!-- Arrow indicator -->
          <i
            v-if="index === selectedIndex"
            class="pi pi-angle-right text-zinc-500 text-sm flex-shrink-0"
          ></i>
        </button>
      </div>

      <!-- No results -->
      <div
        v-else-if="query && !isLoading"
        class="flex flex-col items-center justify-center py-14 text-center"
      >
        <div class="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center mb-4">
          <i class="pi pi-times-circle text-xl text-zinc-500"></i>
        </div>
        <p class="text-zinc-400 text-sm font-medium">No results found</p>
        <p class="text-zinc-600 text-xs mt-1">Try a different search term</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!query" class="flex flex-col items-center justify-center py-14 text-center">
        <div class="w-12 h-12 rounded-2xl bg-zinc-800/60 flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" stroke-linecap="round" />
          </svg>
        </div>
        <p class="text-zinc-400 text-sm font-medium tracking-wide">Search movies & TV shows</p>
        <div class="flex items-center gap-1.5 mt-3">
          <span class="text-zinc-600 text-xs">Press</span>
          <kbd class="spotlight-kbd">&#8984;K</kbd>
          <span class="text-zinc-600 text-xs">anytime</span>
        </div>
      </div>
    </div>

    <!-- Footer hints -->
    <div class="spotlight-footer">
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1.5">
          <kbd class="spotlight-kbd-sm">&uarr;&darr;</kbd>
          <span>navigate</span>
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="spotlight-kbd-sm">&crarr;</kbd>
          <span>open</span>
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="spotlight-kbd-sm">esc</kbd>
          <span>close</span>
        </span>
      </div>
    </div>
  </Dialog>
</template>

<style>
/* ── Backdrop ── */
.spotlight-mask {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  background: rgba(0, 0, 0, 0.5) !important;
}

/* ── Dialog shell ── */
.spotlight-dialog.p-dialog {
  width: 95vw !important;
  max-width: 580px !important;
  margin-top: 12vh !important;
  margin-bottom: auto !important;
  border-radius: 16px !important;
  border: none !important;
  overflow: hidden !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 24px 60px -12px rgba(0, 0, 0, 0.75),
    0 0 100px -20px rgba(229, 9, 20, 0.08) !important;
  animation: spotlight-enter 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.spotlight-dialog .p-dialog-header {
  display: none !important;
}

.spotlight-dialog .p-dialog-content {
  background: rgba(24, 24, 27, 0.97) !important;
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  padding: 0 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
}

/* ── Kill PrimeVue form field focus styles ── */
.spotlight-dialog input,
.spotlight-dialog input:focus,
.spotlight-dialog input:focus-visible,
.spotlight-dialog .p-dialog-content:focus-within {
  border-color: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}

/* ── Input ── */
.spotlight-input {
  flex: 1;
  background: transparent;
  color: #fff;
  font-size: 17px;
  font-weight: 400;
  letter-spacing: -0.01em;
  border: none;
  outline: none;
  padding: 0;
}

.spotlight-input::placeholder {
  color: #52525b;
}

/* ── Results container ── */
.spotlight-results {
  max-height: 420px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.spotlight-results::-webkit-scrollbar {
  width: 4px;
}

.spotlight-results::-webkit-scrollbar-track {
  background: transparent;
}

.spotlight-results::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* ── Result item ── */
.spotlight-result {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 12px;
  border-left: 2px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all 150ms ease-out;
}

.spotlight-result:hover {
  background: rgba(255, 255, 255, 0.04);
}

.spotlight-result--active {
  background: rgba(255, 255, 255, 0.07) !important;
  border-left-color: #e50914;
}

/* ── Footer ── */
.spotlight-footer {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  font-size: 11px;
  color: #52525b;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(24, 24, 27, 0.6);
}

/* ── Kbd badges ── */
.spotlight-kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #71717a;
  background: #27272a;
  border: 1px solid rgba(113, 113, 122, 0.25);
  border-radius: 5px;
  line-height: 1.4;
  flex-shrink: 0;
}

.spotlight-kbd-sm {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 500;
  color: #52525b;
  background: rgba(39, 39, 42, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.4);
  border-radius: 4px;
  line-height: 1.5;
}

/* ── Entry animation ── */
@keyframes spotlight-enter {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
