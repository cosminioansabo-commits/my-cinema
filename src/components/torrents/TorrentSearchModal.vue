<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import TorrentResultCard from './TorrentResultCard.vue'
import { useTorrentsStore } from '@/stores/torrentsStore'
import { useLanguage } from '@/composables/useLanguage'
import type { TorrentResult } from '@/types/torrent'
import type { MediaType } from '@/types'

const { t } = useLanguage()

const props = defineProps<{
  visible: boolean
  title: string
  englishTitle?: string // English title for torrent searches
  year?: number
  mediaType: MediaType
  mediaId: number
  customQuery?: string // For episode-specific searches like "Show Name S01E05"
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const torrentsStore = useTorrentsStore()
const downloadingId = ref<string | null>(null)

const dialogVisible = ref(props.visible)
const editableQuery = ref('')
const isEditingQuery = ref(false)

// Filter results to only show 2160p and 1080p quality
const filteredResults = computed(() => {
  return torrentsStore.searchResults.filter(torrent => {
    const quality = torrent.quality?.toLowerCase() || ''
    return quality.includes('2160') || quality.includes('4k') || quality.includes('1080') || quality.includes('720')
  })
})

watch(() => props.visible, (val) => {
  dialogVisible.value = val
  if (val) {
    // Initialize editable query with the computed search query
    editableQuery.value = searchQuery.value
    isEditingQuery.value = false
    performSearch()
  }
})

watch(dialogVisible, (val) => {
  emit('update:visible', val)
  if (!val) {
    torrentsStore.clearSearch()
  }
})

onMounted(() => {
  if (props.visible) {
    editableQuery.value = searchQuery.value
    performSearch()
  }
})

// Compute the actual search query - use customQuery for episode searches, otherwise use English title
const searchQuery = computed(() => {
  if (props.customQuery) return props.customQuery
  // Always prefer English title for torrent searches (most torrents are named in English)
  return props.englishTitle || props.title
})

// Use editableQuery for actual searches (allows user modification)
async function performSearch() {
  const queryToSearch = editableQuery.value || searchQuery.value
  await torrentsStore.search({
    title: queryToSearch,
    year: props.customQuery ? undefined : props.year, // Don't include year for episode searches
    type: props.mediaType
  })
}

function handleSearchWithNewQuery() {
  isEditingQuery.value = false
  performSearch()
}

async function handleDownload(torrent: TorrentResult) {
  downloadingId.value = torrent.id
  try {
    await torrentsStore.startDownload(torrent, props.mediaId, props.mediaType)
    dialogVisible.value = false
  } catch (error) {
    console.error('Download error:', error)
  } finally {
    downloadingId.value = null
  }
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    closable
    :header="t('torrent.searchTitle')"
    :style="{ width: '90vw', maxWidth: '800px', margin: '0.5rem', overflow: 'hidden' }"
    :breakpoints="{ '640px': '100vw' }"
    :draggable="false"
    class="torrent-search-modal"
    :pt="{
      root: { class: 'torrent-dialog-root' },
      header: { class: 'torrent-dialog-header' },
      content: { class: 'torrent-dialog-content' },
      closeButton: { class: 'torrent-dialog-close' }
    }"
  >
    <!-- Search Input in Content -->
    <div class="search-container">
      <div class="search-input-wrapper">
        <i class="pi pi-search search-icon"></i>
        <InputText
          v-model="editableQuery"
          class="search-input"
          :placeholder="t('torrent.searchPlaceholder')"
          @keyup.enter="handleSearchWithNewQuery"
        />
        <Button
          icon="pi pi-arrow-right"
          severity="primary"
          size="small"
          rounded
          class="search-btn"
          :loading="torrentsStore.isSearching"
          @click="handleSearchWithNewQuery"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="torrentsStore.isSearching" class="state-container">
      <ProgressSpinner
        style="width: 36px; height: 36px"
        strokeWidth="3"
        animationDuration=".8s"
      />
      <p class="state-text">{{ t('torrent.searching') }}</p>
    </div>

    <!-- Error -->
    <div v-else-if="torrentsStore.searchError" class="px-3 py-4">
      <Message severity="error" :closable="false" class="!text-xs">
        {{ torrentsStore.searchError }}
      </Message>
    </div>

    <!-- No Results -->
    <div v-else-if="filteredResults.length === 0" class="state-container">
      <div class="state-icon-wrapper">
        <i class="pi pi-inbox text-xl text-gray-500"></i>
      </div>
      <p class="state-text">{{ t('torrent.noResults') }}</p>
      <p class="state-hint">{{ t('torrent.noResultsHint') }}</p>
      <Button
        :label="t('torrent.searchAgain')"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        text
        class="!text-xs mt-2"
        @click="performSearch"
      />
    </div>

    <!-- Results -->
    <div v-else class="results-container">
      <div class="results-header">
        <span class="results-count">
          {{ t('torrent.showingResults', { count: filteredResults.length }) }}
        </span>
      </div>
      <div class="results-list">
        <TorrentResultCard
          v-for="torrent in filteredResults"
          :key="torrent.id"
          :torrent="torrent"
          :loading="downloadingId === torrent.id"
          @download="handleDownload"
        />
      </div>
    </div>
  </Dialog>
</template>

<style>
/* Dialog root */
.torrent-search-modal .p-dialog {
  border: 1px solid #2a2a2a !important;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

@media (max-width: 640px) {
  .torrent-search-modal .p-dialog {
    border-radius: 16px 16px 0 0;
    margin: 0 !important;
    max-height: 90vh !important;
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}

/* Header */
.torrent-dialog-header {
  background: #1a1a1a !important;
  border-bottom: 1px solid #2a2a2a !important;
  padding: 0.875rem 1rem !important;
  font-size: 0.9375rem !important;
  font-weight: 600 !important;
}

@media (min-width: 640px) {
  .torrent-dialog-header {
    padding: 1rem 1.25rem !important;
    font-size: 1.0625rem !important;
  }
}

/* Close button */
.torrent-dialog-close {
  color: #666 !important;
  width: 2rem !important;
  height: 2rem !important;
  border-radius: 8px !important;
}

.torrent-dialog-close:hover {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.1) !important;
}

/* Content */
.torrent-dialog-content {
  background: #141414 !important;
  padding: 0 !important;
}

/* Search container */
.search-container {
  padding: 0.75rem;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
}

@media (min-width: 640px) {
  .search-container {
    padding: 1rem 1.25rem;
  }
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #252525;
  border-radius: 10px;
  padding: 0.375rem 0.5rem 0.375rem 0.75rem;
  border: 1px solid #333;
  transition: border-color 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: #4a4a4a;
}

.search-icon {
  color: #666;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent !important;
  border: none !important;
  padding: 0.375rem 0.25rem !important;
  font-size: 0.8125rem !important;
  color: white !important;
  box-shadow: none !important;
}

.search-input::placeholder {
  color: #666;
}

.search-btn {
  width: 2rem !important;
  height: 2rem !important;
  flex-shrink: 0;
}

/* State containers (loading, no results) */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
}

.state-icon-wrapper {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #252525;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.state-text {
  color: #888;
  font-size: 0.8125rem;
  margin-top: 0.75rem;
}

.state-hint {
  color: #555;
  font-size: 0.6875rem;
  margin-top: 0.25rem;
}

/* Results */
.results-container {
  max-height: 55vh;
  overflow-y: auto;
}

@media (max-width: 640px) {
  .results-container {
    max-height: 60vh;
  }
}

.results-header {
  padding: 0.5rem 0.75rem;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  position: sticky;
  top: 0;
  z-index: 10;
}

@media (min-width: 640px) {
  .results-header {
    padding: 0.625rem 1.25rem;
  }
}

.results-count {
  font-size: 0.6875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.results-list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

@media (min-width: 640px) {
  .results-list {
    padding: 0.75rem 1rem;
    gap: 0.5rem;
  }
}
</style>
