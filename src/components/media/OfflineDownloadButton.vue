<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import type { MediaDetails, Episode } from '@/types'

const props = defineProps<{
  media: MediaDetails
  episode?: Episode
  variant?: 'icon' | 'full'
}>()

const offlineStore = useOfflineStore()
const toast = useToast()
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
  return 'pi pi-mobile'
})

// Format bytes to human readable size
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const buttonLabel = computed(() => {
  if (props.variant === 'icon') return undefined
  if (isDownloaded.value) return t('offline.downloaded')
  if (isDownloading.value) {
    const progressData = downloadProgress.value
    const progress = progressData?.progress || 0

    // Show download size info if available (for large files)
    if (progressData?.totalBytes && progressData.totalBytes > 0) {
      const downloaded = formatSize(progressData.downloadedBytes)
      const total = formatSize(progressData.totalBytes)
      return `${downloaded} / ${total}`
    }

    // For very small progress values, show "Starting..." or one decimal place
    if (progress < 0.5) {
      return progress === 0 ? t('offline.starting') : `${progress.toFixed(1)}%`
    }
    return `${Math.round(progress)}%`
  }
  return t('offline.downloadForOffline')
})

const handleClick = async () => {
  if (isDownloaded.value) {
    // Already downloaded - could show options to delete
    return
  }

  if (isDownloading.value) {
    // Cancel download
    offlineStore.cancelDownload(mediaId.value)
    toast.add({
      severity: 'info',
      summary: t('offline.downloadCancelled'),
      life: 3000
    })
    return
  }

  // Start download
  try {
    await offlineStore.startDownload(props.media, props.episode)
    toast.add({
      severity: 'info',
      summary: t('offline.downloadStarted'),
      detail: props.media.title,
      life: 3000
    })
  } catch (error) {
    console.error('[OfflineDownload] Failed to start download:', error)
    toast.add({
      severity: 'error',
      summary: t('offline.downloadFailed'),
      detail: error instanceof Error ? error.message : 'Unknown error',
      life: 5000
    })
  }
}
</script>

<template>
  <div class="offline-download-button" :class="{ 'icon-variant': variant === 'icon' }">
    <!-- Icon-only variant (simplified) -->
    <button
      v-if="variant === 'icon'"
      @click="handleClick"
      :disabled="isDownloaded"
      class="icon-only-btn"
      :class="{
        'is-downloaded': isDownloaded,
        'is-downloading': isDownloading
      }"
      :title="isDownloaded ? t('offline.downloaded') : isDownloading ? t('offline.downloading') : t('offline.downloadForOffline')"
    >
      <i :class="buttonIcon"></i>
    </button>

    <!-- Full button variant -->
    <template v-else>
      <Button
        :icon="buttonIcon"
        :label="buttonLabel"
        :disabled="isDownloaded"
        @click="handleClick"
        :class="[
          'action-btn',
          isDownloaded ? 'action-btn-downloaded' : '',
          isDownloading ? 'action-btn-downloading' : 'action-btn-offline'
        ]"
      />

      <!-- Progress bar overlay for downloading state -->
      <div
        v-if="isDownloading"
        class="progress-bar"
        :style="{ width: `${downloadProgress?.progress || 0}%` }"
      />
    </template>
  </div>
</template>

<style>
.offline-download-button {
  position: relative;
  display: inline-flex;
}

/* Icon-only variant - minimal style */
.icon-only-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-only-btn:hover:not(:disabled) {
  color: #22d3ee;
  background: rgba(255, 255, 255, 0.1);
}

.icon-only-btn i {
  font-size: 1.125rem;
}

.icon-only-btn.is-downloading {
  color: #22d3ee;
}

.icon-only-btn.is-downloading:hover {
  color: #ef4444;
}

.icon-only-btn.is-downloaded {
  color: #4ade80;
  cursor: default;
}

.icon-only-btn:disabled {
  opacity: 1;
}

/* Base action button styles - matches MediaDetailView */
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

/* Default offline download button - Matches secondary button style */
.action-btn-offline {
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%) !important;
  color: white !important;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

.action-btn-offline:hover {
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
  transform: translateY(-2px);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.action-btn-offline:active {
  transform: translateY(0);
}

.action-btn-offline .p-button-icon {
  font-size: 1rem;
  color: #06b6d4 !important;
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

.action-btn-downloading .p-button-icon {
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

.action-btn-downloaded .p-button-icon {
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
