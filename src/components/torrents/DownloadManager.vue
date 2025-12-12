<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import OverlayPanel from 'primevue/overlaypanel'
import { ref } from 'vue'
import DownloadProgress from './DownloadProgress.vue'
import { useTorrentsStore } from '@/stores/torrentsStore'

const router = useRouter()
const torrentsStore = useTorrentsStore()
const op = ref()

const activeCount = computed(() => torrentsStore.activeDownloads.length)

onMounted(() => {
  torrentsStore.connectWebSocket()
})

onUnmounted(() => {
  torrentsStore.disconnectWebSocket()
})

function toggle(event: Event) {
  op.value.toggle(event)
}

function goToDownloads() {
  op.value.hide()
  router.push('/downloads')
}
</script>

<template>
  <div class="download-manager">
    <Button
      icon="pi pi-download"
      text
      rounded
      severity="secondary"
      @click="toggle"
      aria-label="Downloads"
      class="relative"
    >
      <template #icon>
        <i class="pi pi-download"></i>
        <Badge
          v-if="activeCount > 0"
          :value="activeCount"
          severity="success"
          class="absolute -top-1 -right-1"
        />
      </template>
    </Button>

    <OverlayPanel ref="op" :style="{ width: '400px' }">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Downloads</h3>
        <Button
          label="View All"
          link
          size="small"
          @click="goToDownloads"
        />
      </div>

      <!-- Connection status -->
      <div class="flex items-center gap-2 mb-4 text-xs">
        <span
          class="w-2 h-2 rounded-full"
          :class="torrentsStore.wsConnected ? 'bg-green-500' : 'bg-red-500'"
        ></span>
        <span class="text-gray-400">
          {{ torrentsStore.wsConnected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>

      <!-- No downloads -->
      <div v-if="torrentsStore.downloads.length === 0" class="text-center py-6">
        <i class="pi pi-inbox text-3xl text-gray-500 mb-2"></i>
        <p class="text-gray-400 text-sm">No downloads yet</p>
      </div>

      <!-- Downloads list -->
      <div v-else class="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
        <DownloadProgress
          v-for="download in torrentsStore.downloads.slice(0, 5)"
          :key="download.id"
          :download="download"
          @pause="torrentsStore.pauseDownload"
          @resume="torrentsStore.resumeDownload"
          @cancel="torrentsStore.cancelDownload"
        />

        <p
          v-if="torrentsStore.downloads.length > 5"
          class="text-center text-xs text-gray-500"
        >
          + {{ torrentsStore.downloads.length - 5 }} more downloads
        </p>
      </div>
    </OverlayPanel>
  </div>
</template>
