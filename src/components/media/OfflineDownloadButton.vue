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
      :text="variant === 'icon'"
      :rounded="variant === 'icon'"
      :disabled="isDownloaded"
      @click="handleClick"
      :class="[
        variant === 'icon' ? 'icon-btn' : 'action-btn',
        isDownloaded ? 'action-btn-downloaded' : '',
        isDownloading ? 'action-btn-downloading' : 'action-btn-offline'
      ]"
    />

    <!-- Progress bar overlay for downloading state -->
    <div
      v-if="isDownloading && variant !== 'icon'"
      class="progress-bar"
      :style="{ width: `${downloadProgress?.progress || 0}%` }"
    />
  </div>
</template>

<style scoped>
.offline-download-button {
  position: relative;
  display: inline-flex;
}

/* Icon variant */
.icon-btn {
  color: white !important;
  background: transparent !important;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
}

/* Base action button styles */
.action-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em;
  border: none !important;
  border-radius: 9999px !important;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
  overflow: hidden;
}

@media (min-width: 640px) {
  .action-btn {
    padding: 0.75rem 1.5rem !important;
    font-size: 0.875rem !important;
  }
}

/* Default offline download button - Cyan/Teal accent */
.action-btn-offline {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%) !important;
  color: white !important;
  box-shadow:
    0 4px 14px rgba(6, 182, 212, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}

.action-btn-offline:hover {
  background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%) !important;
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(6, 182, 212, 0.45),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.action-btn-offline:active {
  transform: translateY(0);
}

.action-btn-offline :deep(.p-button-icon) {
  font-size: 1rem;
}

/* Downloading state - Animated with subtle pulse */
.action-btn-downloading {
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%) !important;
  color: white !important;
  border: 1px solid rgba(6, 182, 212, 0.4) !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 20px rgba(6, 182, 212, 0.15) !important;
  animation: pulse-glow 2s ease-in-out infinite;
}

.action-btn-downloading:hover {
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
}

.action-btn-downloading :deep(.p-button-icon) {
  color: #22d3ee !important;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 20px rgba(6, 182, 212, 0.15);
  }
  50% {
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 30px rgba(6, 182, 212, 0.3);
  }
}

/* Downloaded state - Success with checkmark */
.action-btn-downloaded {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.15) 100%) !important;
  color: #4ade80 !important;
  border: 2px solid rgba(34, 197, 94, 0.4) !important;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15) !important;
  cursor: default !important;
}

.action-btn-downloaded :deep(.p-button-icon) {
  color: #4ade80 !important;
}

/* Progress bar */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #06b6d4, #22d3ee);
  transition: width 0.3s ease;
  border-radius: 0 0 9999px 9999px;
}
</style>
