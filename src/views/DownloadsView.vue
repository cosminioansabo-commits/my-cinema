<script setup lang="ts">
import { onMounted, computed } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DownloadProgress from '@/components/torrents/DownloadProgress.vue'
import { useTorrentsStore } from '@/stores/torrentsStore'

const torrentsStore = useTorrentsStore()

onMounted(() => {
  torrentsStore.fetchDownloads()
  torrentsStore.connectWebSocket()
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
</script>

<template>
  <div class="downloads-view p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-white">Downloads</h1>

      <div class="flex items-center gap-2 text-sm">
        <span
          class="w-2 h-2 rounded-full"
          :class="torrentsStore.wsConnected ? 'bg-green-500' : 'bg-red-500'"
        ></span>
        <span class="text-gray-400">
          {{ torrentsStore.wsConnected ? 'Server Connected' : 'Server Disconnected' }}
        </span>
      </div>
    </div>

    <Tabs value="active">
      <TabList>
        <Tab value="active">
          Active
          <span v-if="activeDownloads.length" class="ml-2 text-xs bg-blue-500 px-2 py-0.5 rounded-full">
            {{ activeDownloads.length }}
          </span>
        </Tab>
        <Tab value="completed">
          Completed
          <span v-if="completedDownloads.length" class="ml-2 text-xs bg-green-500 px-2 py-0.5 rounded-full">
            {{ completedDownloads.length }}
          </span>
        </Tab>
        <Tab value="failed">
          Failed
          <span v-if="failedDownloads.length" class="ml-2 text-xs bg-red-500 px-2 py-0.5 rounded-full">
            {{ failedDownloads.length }}
          </span>
        </Tab>
      </TabList>

      <TabPanels class="mt-4">
        <!-- Active Downloads -->
        <TabPanel value="active">
          <div v-if="activeDownloads.length === 0" class="text-center py-12">
            <i class="pi pi-download text-5xl text-gray-600 mb-4"></i>
            <p class="text-gray-400">No active downloads</p>
            <p class="text-gray-500 text-sm mt-2">
              Find a movie or TV show and click "Find Torrent" to start downloading
            </p>
          </div>

          <div v-else class="flex flex-col gap-4">
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
        <TabPanel value="completed">
          <div v-if="completedDownloads.length === 0" class="text-center py-12">
            <i class="pi pi-check-circle text-5xl text-gray-600 mb-4"></i>
            <p class="text-gray-400">No completed downloads</p>
          </div>

          <div v-else class="flex flex-col gap-4">
            <DownloadProgress
              v-for="download in completedDownloads"
              :key="download.id"
              :download="download"
              @cancel="torrentsStore.cancelDownload"
            />
          </div>
        </TabPanel>

        <!-- Failed Downloads -->
        <TabPanel value="failed">
          <div v-if="failedDownloads.length === 0" class="text-center py-12">
            <i class="pi pi-times-circle text-5xl text-gray-600 mb-4"></i>
            <p class="text-gray-400">No failed downloads</p>
          </div>

          <div v-else class="flex flex-col gap-4">
            <DownloadProgress
              v-for="download in failedDownloads"
              :key="download.id"
              :download="download"
              @cancel="torrentsStore.cancelDownload"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
