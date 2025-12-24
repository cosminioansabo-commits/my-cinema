<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Button from 'primevue/button'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import type { MediaDetails, Episode } from '@/types'

const props = defineProps<{
  media: MediaDetails
  episode?: Episode
  variant?: 'icon' | 'full'
}>()

const offlineStore = useOfflineStore()
const { t } = useLanguage()

const mediaId = computed(() => {
  if (props.episode) {
    return `${props.media.mediaType}-${props.media.id}-s${props.episode.seasonNumber}e${props.episode.episodeNumber}`
  }
  return `${props.media.mediaType}-${props.media.id}`
})

const isDownloaded = computed(() =>
  offlineStore.isMediaDownloaded(
    props.media.id,
    props.media.mediaType,
    props.episode?.seasonNumber,
    props.episode?.episodeNumber
  )
)

const isDownloading = computed(() =>
  offlineStore.isMediaDownloading(
    props.media.id,
    props.media.mediaType,
    props.episode?.seasonNumber,
    props.episode?.episodeNumber
  )
)

const downloadProgress = computed(() =>
  offlineStore.getDownloadProgress(
    props.media.id,
    props.media.mediaType,
    props.episode?.seasonNumber,
    props.episode?.episodeNumber
  )
)

const buttonIcon = computed(() => {
  if (isDownloaded.value) return 'pi pi-check-circle'
  if (isDownloading.value) return 'pi pi-spin pi-spinner'
  return 'pi pi-download'
})

const buttonLabel = computed(() => {
  if (props.variant === 'icon') return undefined
  if (isDownloaded.value) return t('offline.downloaded')
  if (isDownloading.value) {
    const progress = downloadProgress.value?.progress || 0
    return `${Math.round(progress)}%`
  }
  return t('offline.downloadForOffline')
})

const buttonSeverity = computed(() => {
  if (isDownloaded.value) return 'success'
  if (isDownloading.value) return 'secondary'
  return 'secondary'
})

const handleClick = async () => {
  if (isDownloaded.value) {
    // Already downloaded - could show options to delete
    return
  }

  if (isDownloading.value) {
    // Cancel download
    offlineStore.cancelDownload(mediaId.value)
    return
  }

  // Start download
  try {
    await offlineStore.startDownload(props.media, props.episode)
  } catch (error) {
    console.error('Failed to start download:', error)
  }
}

onMounted(() => {
  offlineStore.syncActiveDownloads()
})
</script>

<template>
  <div v-if="offlineStore.isDownloadSupported" class="offline-download-button">
    <Button
      :icon="buttonIcon"
      :label="buttonLabel"
      :severity="buttonSeverity"
      :text="variant === 'icon'"
      :rounded="variant === 'icon'"
      :disabled="isDownloaded"
      @click="handleClick"
      :class="[
        variant === 'icon' ? '!text-white hover:!bg-white/20' : '',
        isDownloading ? 'downloading' : ''
      ]"
      v-tooltip.top="isDownloaded ? t('offline.alreadyDownloaded') : isDownloading ? t('offline.cancelDownload') : t('offline.downloadForOffline')"
    />

    <!-- Progress bar overlay for downloading state -->
    <div
      v-if="isDownloading && variant !== 'icon'"
      class="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-300 rounded-b-lg"
      :style="{ width: `${downloadProgress?.progress || 0}%` }"
    />
  </div>
</template>

<style scoped>
.offline-download-button {
  position: relative;
  display: inline-block;
}

.downloading {
  position: relative;
  overflow: hidden;
}
</style>
