<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Button from 'primevue/button'
import DownloadProgress from '@/components/torrents/DownloadProgress.vue'
import OfflineMediaCard from '@/components/media/OfflineMediaCard.vue'
import PlaybackModal from '@/components/modals/PlaybackModal.vue'
import { useTorrentsStore } from '@/stores/torrentsStore'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import type { OfflineMediaItem } from '@/services/offlineStorageService'

const torrentsStore = useTorrentsStore()
const offlineStore = useOfflineStore()
const { t } = useLanguage()

// Offline playback state
const showPlaybackModal = ref(false)
const currentOfflineItem = ref<OfflineMediaItem | null>(null)

onMounted(() => {
  torrentsStore.fetchDownloads()
  torrentsStore.connectWebSocket()
  offlineStore.loadOfflineMedia()
  offlineStore.initializeListeners()
})

const activeDownloads = computed(() =>
  torrentsStore.downloads.filter(d =>
    d.status === 'downloading' || d.status === 'paused' || d.status === 'queued'
  )
)

const completedDownloads = computed(() =>
  torrentsStore.downloads.filter(d => d.status === 'completed')
)

const failedDownloads = computed(() =>
  torrentsStore.downloads.filter(d => d.status === 'error')
)

const storageUsedFormatted = computed(() => offlineStore.formatFileSize(offlineStore.totalOfflineSize))
const storageAvailableFormatted = computed(() => offlineStore.formatFileSize(offlineStore.storageEstimate.available))

const handlePlayOffline = (item: OfflineMediaItem) => {
  currentOfflineItem.value = item
  showPlaybackModal.value = true
}

const handleDeleteOffline = (_item: OfflineMediaItem) => {
  // Item already deleted by the card component, refresh is automatic
}
</script>

<template>
  <div class="downloads-view max-w-4xl mx-auto py-6">
    <div class="flex items-center justify-between mb-4 sm:mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-white">Downloads</h1>

      <div class="flex items-center gap-2 text-xs sm:text-sm">
        <span
          class="w-2 h-2 rounded-full"
          :class="torrentsStore.wsConnected ? 'bg-green-500' : 'bg-red-500'"
        ></span>
        <span class="text-gray-400">
          {{ torrentsStore.wsConnected ? 'Server Connected' : 'Disconnected' }}
        </span>
      </div>
    </div>

    <div class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <Tabs value="active" class="downloads-tabs">
        <TabList class="bg-zinc-900 border-b border-zinc-800 px-2 sm:px-4">
          <Tab value="active" class="downloads-tab">
            Active
            <span v-if="activeDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-purple-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ activeDownloads.length }}
            </span>
          </Tab>
          <Tab value="completed" class="downloads-tab">
            Completed
            <span v-if="completedDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-green-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ completedDownloads.length }}
            </span>
          </Tab>
          <Tab value="failed" class="downloads-tab">
            Failed
            <span v-if="failedDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-red-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ failedDownloads.length }}
            </span>
          </Tab>
          <Tab v-if="offlineStore.isDownloadSupported" value="offline" class="downloads-tab">
            {{ t('offline.title') }}
            <span v-if="offlineStore.offlineMedia.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ offlineStore.offlineMedia.length }}
            </span>
          </Tab>
        </TabList>

        <TabPanels class="bg-zinc-900">
          <!-- Active Downloads -->
          <TabPanel value="active" class="p-3 sm:p-4">
            <div v-if="activeDownloads.length === 0" class="text-center py-10 sm:py-16">
              <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <i class="pi pi-download text-2xl sm:text-3xl text-gray-500"></i>
              </div>
              <p class="text-gray-400 text-sm sm:text-base">No active downloads</p>
              <p class="text-gray-500 text-xs sm:text-sm mt-2 max-w-xs mx-auto">
                Find a movie or TV show and click "Find Torrent" to start downloading
              </p>
            </div>

            <div v-else class="flex flex-col gap-2 sm:gap-4 p-2 sm:p-4">
              <DownloadProgress
                v-for="download in activeDownloads"
                :key="download.id"
                :download="download"
                @pause="torrentsStore.pauseDownload"
                @resume="torrentsStore.resumeDownload"
                @cancel="torrentsStore.cancelDownload"
              />
            </div>
          </TabPanel>

          <!-- Completed Downloads -->
          <TabPanel value="completed" class="p-3 sm:p-4">
            <div v-if="completedDownloads.length === 0" class="text-center py-10 sm:py-16">
              <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <i class="pi pi-check-circle text-2xl sm:text-3xl text-gray-500"></i>
              </div>
              <p class="text-gray-400 text-sm sm:text-base">No completed downloads</p>
            </div>

            <div v-else class="flex flex-col gap-2 sm:gap-4 p-2 sm:p-4">
              <DownloadProgress
                v-for="download in completedDownloads"
                :key="download.id"
                :download="download"
                @cancel="torrentsStore.cancelDownload"
              />
            </div>
          </TabPanel>

          <!-- Failed Downloads -->
          <TabPanel value="failed" class="p-3 sm:p-4">
            <div v-if="failedDownloads.length === 0" class="text-center py-10 sm:py-16">
              <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <i class="pi pi-times-circle text-2xl sm:text-3xl text-gray-500"></i>
              </div>
              <p class="text-gray-400 text-sm sm:text-base">No failed downloads</p>
            </div>

            <div v-else class="flex flex-col gap-2 sm:gap-4 p-2 sm:p-4">
              <DownloadProgress
                v-for="download in failedDownloads"
                :key="download.id"
                :download="download"
                @cancel="torrentsStore.cancelDownload"
              />
            </div>
          </TabPanel>

          <!-- Offline Downloads -->
          <TabPanel v-if="offlineStore.isDownloadSupported" value="offline" class="p-3 sm:p-4">
            <!-- Storage info -->
            <div v-if="offlineStore.offlineMedia.length > 0" class="mb-4 p-3 bg-zinc-800 rounded-lg">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">{{ t('offline.storageUsed') }}</span>
                <span class="text-white font-medium">{{ storageUsedFormatted }}</span>
              </div>
              <div class="mt-2 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-500 transition-all"
                  :style="{ width: `${(offlineStore.storageEstimate.usage / offlineStore.storageEstimate.quota) * 100}%` }"
                />
              </div>
              <div class="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>{{ t('offline.available') }}: {{ storageAvailableFormatted }}</span>
                <Button
                  :label="t('offline.clearAll')"
                  severity="danger"
                  text
                  size="small"
                  @click="offlineStore.clearAllOfflineMedia()"
                />
              </div>
            </div>

            <!-- Active offline downloads -->
            <div v-if="offlineStore.hasActiveDownloads" class="mb-4">
              <h3 class="text-sm font-medium text-gray-400 mb-2">{{ t('offline.downloading') }}</h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="download in offlineStore.activeDownloads"
                  :key="download.id"
                  class="p-3 bg-zinc-800 rounded-lg"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-white text-sm truncate">{{ download.media.title }}</span>
                    <Button
                      icon="pi pi-times"
                      severity="danger"
                      text
                      rounded
                      size="small"
                      @click="offlineStore.cancelDownload(download.id)"
                    />
                  </div>
                  <div class="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-blue-500 transition-all"
                      :style="{ width: `${download.progress.progress}%` }"
                    />
                  </div>
                  <div class="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>{{ Math.round(download.progress.progress) }}%</span>
                    <span>{{ offlineStore.formatFileSize(download.progress.downloadedBytes) }} / {{ offlineStore.formatFileSize(download.progress.totalBytes) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Downloaded media -->
            <div v-if="offlineStore.offlineMedia.length === 0 && !offlineStore.hasActiveDownloads" class="text-center py-10 sm:py-16">
              <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <i class="pi pi-cloud-download text-2xl sm:text-3xl text-gray-500"></i>
              </div>
              <p class="text-gray-400 text-sm sm:text-base">{{ t('offline.noDownloads') }}</p>
              <p class="text-gray-500 text-xs sm:text-sm mt-2 max-w-xs mx-auto">
                {{ t('offline.noDownloadsHint') }}
              </p>
            </div>

            <div v-else class="grid grid-cols-1 gap-3">
              <OfflineMediaCard
                v-for="item in offlineStore.offlineMedia"
                :key="item.id"
                :item="item"
                @play="handlePlayOffline"
                @delete="handleDeleteOffline"
              />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <!-- Offline Playback Modal -->
    <PlaybackModal
      v-if="currentOfflineItem"
      v-model:visible="showPlaybackModal"
      :media-type="currentOfflineItem.mediaType"
      :title="currentOfflineItem.title"
      :offline-item="currentOfflineItem"
    />
  </div>
</template>

<style>
/* Dark mode styling for tabs */
.downloads-tabs .p-tablist {
  background: transparent !important;
  border: none !important;
}

.downloads-tabs .p-tab {
  background: transparent !important;
  border: none !important;
  color: #9ca3af !important;
  padding: 0.75rem 1rem !important;
  font-size: 0.875rem !important;
  transition: all 0.2s !important;
}

@media (max-width: 640px) {
  .downloads-tabs .p-tab {
    padding: 0.625rem 0.75rem !important;
    font-size: 0.75rem !important;
  }
}

.downloads-tabs .p-tab:hover {
  color: #e5e7eb !important;
}

.downloads-tabs .p-tab[data-p-active="true"] {
  color: #a855f7 !important;
  border-bottom: 2px solid #a855f7 !important;
}

.downloads-tabs .p-tablist-active-bar {
  display: none !important;
}

.downloads-tabs .p-tabpanels {
  background: transparent !important;
  padding: 0 !important;
}

.downloads-tabs .p-tabpanel {
  padding: 0 !important;
}
</style>
