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
import CircularProgress from '@/components/ui/CircularProgress.vue'
import { useTorrentsStore } from '@/stores/torrentsStore'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import { getImageUrl } from '@/services/tmdbService'
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
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
      <div>
        <div class="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          <div class="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <i class="pi pi-download text-lg sm:text-2xl text-white"></i>
          </div>
          <h1 class="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Downloads
          </h1>
        </div>
      </div>

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
      <Tabs value="active">
        <TabList
          :pt="{
            root: { class: '!bg-zinc-900 !border-b !border-zinc-800 px-2 sm:px-4' },
            activeBar: { class: '!hidden' }
          }"
        >
          <Tab
            value="active"
            :pt="{
              root: { class: '!bg-transparent !border-none !text-gray-400 hover:!text-gray-200 !py-2.5 sm:!py-3 !px-3 sm:!px-4 !text-xs sm:!text-sm data-[p-active=true]:!text-purple-400 data-[p-active=true]:!border-b-2 data-[p-active=true]:!border-purple-500' }
            }"
          >
            Active
            <span v-if="activeDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-purple-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ activeDownloads.length }}
            </span>
          </Tab>
          <Tab
            value="completed"
            :pt="{
              root: { class: '!bg-transparent !border-none !text-gray-400 hover:!text-gray-200 !py-2.5 sm:!py-3 !px-3 sm:!px-4 !text-xs sm:!text-sm data-[p-active=true]:!text-purple-400 data-[p-active=true]:!border-b-2 data-[p-active=true]:!border-purple-500' }
            }"
          >
            Completed
            <span v-if="completedDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-green-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ completedDownloads.length }}
            </span>
          </Tab>
          <Tab
            value="failed"
            :pt="{
              root: { class: '!bg-transparent !border-none !text-gray-400 hover:!text-gray-200 !py-2.5 sm:!py-3 !px-3 sm:!px-4 !text-xs sm:!text-sm data-[p-active=true]:!text-purple-400 data-[p-active=true]:!border-b-2 data-[p-active=true]:!border-purple-500' }
            }"
          >
            Failed
            <span v-if="failedDownloads.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-red-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ failedDownloads.length }}
            </span>
          </Tab>
          <Tab
            v-if="offlineStore.isDownloadSupported"
            value="offline"
            :pt="{
              root: { class: '!bg-transparent !border-none !text-gray-400 hover:!text-gray-200 !py-2.5 sm:!py-3 !px-3 sm:!px-4 !text-xs sm:!text-sm data-[p-active=true]:!text-purple-400 data-[p-active=true]:!border-b-2 data-[p-active=true]:!border-purple-500' }
            }"
          >
            {{ t('offline.title') }}
            <span v-if="offlineStore.offlineMedia.length" class="ml-1.5 sm:ml-2 text-[10px] sm:text-xs bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
              {{ offlineStore.offlineMedia.length }}
            </span>
          </Tab>
        </TabList>

        <TabPanels :pt="{ root: { class: '!bg-zinc-900 !p-0' } }">
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
            <div v-if="offlineStore.hasActiveDownloads" class="mb-6">
              <h3 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <i class="pi pi-download text-blue-400"></i>
                {{ t('offline.downloading') }}
              </h3>
              <div class="flex flex-col gap-3">
                <div
                  v-for="download in offlineStore.activeDownloads"
                  :key="download.id"
                  class="p-3 bg-zinc-800/70 rounded-xl border border-blue-500/20"
                >
                  <div class="flex items-center gap-3">
                    <!-- Poster with circular progress overlay -->
                    <div class="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-700">
                      <img
                        v-if="download.media.posterPath"
                        :src="getImageUrl(download.media.posterPath, 'w200') || ''"
                        :alt="download.media.title"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center">
                        <i class="pi pi-image text-zinc-500"></i>
                      </div>
                      <!-- Progress overlay -->
                      <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <CircularProgress
                          :progress="download.progress.progress"
                          :size="40"
                          :stroke-width="3"
                          color="#3b82f6"
                          track-color="rgba(255,255,255,0.2)"
                        />
                      </div>
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <span class="text-white font-medium text-sm block truncate">{{ download.media.title }}</span>
                      <span v-if="download.episode" class="text-gray-400 text-xs block truncate">
                        S{{ download.episode.seasonNumber }}E{{ download.episode.episodeNumber }}
                        <span v-if="download.episode.name"> - {{ download.episode.name }}</span>
                      </span>

                      <!-- Progress bar -->
                      <div class="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                          :style="{ width: `${download.progress.progress}%` }"
                        />
                      </div>

                      <!-- Stats -->
                      <div class="flex items-center justify-between mt-1.5 text-xs">
                        <span class="text-gray-400">
                          {{ offlineStore.formatFileSize(download.progress.downloadedBytes) }} / {{ offlineStore.formatFileSize(download.progress.totalBytes) }}
                        </span>
                        <span class="text-blue-400 font-medium">
                          {{ download.progress.progress < 1 ? download.progress.progress.toFixed(1) : Math.round(download.progress.progress) }}%
                        </span>
                      </div>
                    </div>

                    <!-- Cancel button -->
                    <Button
                      icon="pi pi-times"
                      severity="secondary"
                      text
                      rounded
                      size="small"
                      class="!w-8 !h-8 flex-shrink-0"
                      v-tooltip.top="t('offline.cancelDownload')"
                      @click="offlineStore.cancelDownload(download.id)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Interrupted downloads (from page refresh) -->
            <div v-if="offlineStore.interruptedDownloads.length > 0" class="mb-6">
              <h3 class="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <i class="pi pi-exclamation-triangle"></i>
                {{ t('offline.interrupted') }}
              </h3>
              <div class="flex flex-col gap-3">
                <div
                  v-for="download in offlineStore.interruptedDownloads"
                  :key="download.id"
                  class="p-4 bg-zinc-800/70 rounded-xl border border-yellow-600/30"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <span class="text-white font-medium text-sm block truncate">{{ download.title }}</span>
                      <span v-if="download.seasonNumber !== undefined" class="text-gray-400 text-xs">
                        S{{ download.seasonNumber }}E{{ download.episodeNumber }}
                        <span v-if="download.episodeName"> - {{ download.episodeName }}</span>
                      </span>
                      <p class="text-xs text-yellow-400/80 mt-1">
                        {{ t('offline.interruptedHint') }}
                      </p>
                    </div>
                    <Button
                      icon="pi pi-times"
                      severity="secondary"
                      text
                      rounded
                      size="small"
                      v-tooltip.top="t('common.remove')"
                      @click="offlineStore.clearInterruptedDownload(download.id)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Downloaded media -->
            <div v-if="offlineStore.offlineMedia.length === 0 && !offlineStore.hasActiveDownloads && offlineStore.interruptedDownloads.length === 0" class="text-center py-10 sm:py-16">
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
      :tmdb-id="currentOfflineItem.mediaType === 'movie' ? currentOfflineItem.tmdbId : undefined"
      :show-tmdb-id="currentOfflineItem.mediaType === 'tv' ? currentOfflineItem.tmdbId : undefined"
      :season-number="currentOfflineItem.seasonNumber"
      :episode-number="currentOfflineItem.episodeNumber"
      :title="currentOfflineItem.title"
      :offline-item="currentOfflineItem"
    />
  </div>
</template>

<!-- Tab styling now handled via pt props -->
