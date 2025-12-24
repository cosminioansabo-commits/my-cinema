<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useOfflineStore } from '@/stores/offlineStore'
import { useLanguage } from '@/composables/useLanguage'
import { formatTime } from '@/utils/formatters'
import type { OfflineMediaItem } from '@/services/offlineStorageService'

const props = defineProps<{
  item: OfflineMediaItem
}>()

const emit = defineEmits<{
  play: [item: OfflineMediaItem]
  delete: [item: OfflineMediaItem]
}>()

const offlineStore = useOfflineStore()
const { t } = useLanguage()

const posterUrl = ref<string | null>(null)
const showDeleteConfirm = ref(false)

const title = computed(() => {
  if (props.item.mediaType === 'tv' && props.item.episodeTitle) {
    return `${props.item.title} - S${props.item.seasonNumber}E${props.item.episodeNumber}`
  }
  return props.item.title
})

const subtitle = computed(() => {
  if (props.item.mediaType === 'tv' && props.item.episodeTitle) {
    return props.item.episodeTitle
  }
  return props.item.releaseDate ? new Date(props.item.releaseDate).getFullYear().toString() : ''
})

const formattedSize = computed(() => offlineStore.formatFileSize(props.item.fileSize))

const formattedDuration = computed(() => {
  if (!props.item.duration) return ''
  return formatTime(props.item.duration)
})

const progressPercent = computed(() => {
  if (!props.item.playbackPosition || !props.item.duration) return 0
  return (props.item.playbackPosition / props.item.duration) * 100
})

const hasProgress = computed(() => progressPercent.value > 0 && progressPercent.value < 95)

const remainingTime = computed(() => {
  if (!props.item.playbackPosition || !props.item.duration) return ''
  const remaining = props.item.duration - props.item.playbackPosition
  return formatTime(remaining)
})

const handlePlay = () => {
  emit('play', props.item)
}

const handleDelete = () => {
  showDeleteConfirm.value = true
}

const confirmDelete = async () => {
  await offlineStore.deleteOfflineMedia(props.item.id)
  showDeleteConfirm.value = false
  emit('delete', props.item)
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
}

onMounted(async () => {
  posterUrl.value = await offlineStore.getOfflinePosterUrl(props.item.id)
})
</script>

<template>
  <Card class="offline-media-card overflow-hidden">
    <template #content>
      <div class="flex gap-4">
        <!-- Poster -->
        <div class="relative w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
          <img
            v-if="posterUrl"
            :src="posterUrl"
            :alt="item.title"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <i class="pi pi-image text-2xl text-zinc-600"></i>
          </div>

          <!-- Play overlay -->
          <div
            class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            @click="handlePlay"
          >
            <i class="pi pi-play text-3xl text-white"></i>
          </div>

          <!-- Progress bar -->
          <div v-if="hasProgress" class="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700">
            <div
              class="h-full bg-red-500 transition-all"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-white text-sm truncate">{{ title }}</h3>
          <p v-if="subtitle" class="text-gray-400 text-xs mt-0.5">{{ subtitle }}</p>

          <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span v-if="formattedDuration">
              <i class="pi pi-clock mr-1"></i>{{ formattedDuration }}
            </span>
            <span>
              <i class="pi pi-database mr-1"></i>{{ formattedSize }}
            </span>
          </div>

          <p v-if="hasProgress" class="text-xs text-gray-400 mt-1">
            {{ remainingTime }} {{ t('offline.remaining') }}
          </p>

          <div class="flex items-center gap-2 mt-3">
            <Button
              icon="pi pi-play"
              :label="hasProgress ? t('media.resume') : t('media.play')"
              size="small"
              @click="handlePlay"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click="handleDelete"
              v-tooltip.top="t('offline.deleteDownload')"
            />
          </div>
        </div>
      </div>

      <!-- Delete confirmation overlay -->
      <div
        v-if="showDeleteConfirm"
        class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-10"
      >
        <p class="text-white text-sm text-center mb-4">
          {{ t('offline.confirmDelete') }}
        </p>
        <div class="flex gap-2">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            size="small"
            @click="cancelDelete"
          />
          <Button
            :label="t('common.delete')"
            severity="danger"
            size="small"
            @click="confirmDelete"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.offline-media-card {
  position: relative;
}

.offline-media-card :deep(.p-card-content) {
  padding: 0.75rem;
}
</style>
