<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
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
  <div class="offline-media-card relative bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
    <div class="flex gap-4 p-3">
      <!-- Poster -->
      <div class="relative w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-700">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          :alt="item.title"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
          <i class="pi pi-image text-xl text-zinc-500"></i>
        </div>

        <!-- Progress bar on poster -->
        <div v-if="hasProgress" class="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/80">
          <div
            class="h-full bg-red-500 transition-all"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 class="font-semibold text-white text-sm leading-tight">{{ title }}</h3>
          <p v-if="subtitle" class="text-gray-400 text-xs mt-0.5 truncate">{{ subtitle }}</p>

          <div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span v-if="formattedDuration" class="flex items-center gap-1">
              <i class="pi pi-clock text-[10px]"></i>
              <span>{{ formattedDuration }}</span>
            </span>
            <span class="flex items-center gap-1">
              <i class="pi pi-database text-[10px]"></i>
              <span>{{ formattedSize }}</span>
            </span>
          </div>

          <p v-if="hasProgress" class="text-xs text-gray-400 mt-1">
            {{ remainingTime }} {{ t('offline.remaining') }}
          </p>
        </div>

        <div class="flex items-center gap-2 mt-2">
          <Button
            :icon="hasProgress ? 'pi pi-step-forward' : 'pi pi-play'"
            :label="hasProgress ? t('media.resume') : t('media.play')"
            size="small"
            class="!py-1.5 !px-3 !text-xs"
            @click="handlePlay"
          />
          <Button
            icon="pi pi-trash"
            severity="secondary"
            text
            rounded
            size="small"
            class="!w-8 !h-8"
            @click="handleDelete"
            v-tooltip.top="t('offline.deleteDownload')"
          />
        </div>
      </div>
    </div>

    <!-- Delete confirmation overlay -->
    <Transition name="fade">
      <div
        v-if="showDeleteConfirm"
        class="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10"
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
    </Transition>
  </div>
</template>

<style scoped>
.offline-media-card {
  transition: all 0.2s ease;
}

.offline-media-card:hover {
  border-color: rgba(113, 113, 122, 0.7);
  background-color: rgba(39, 39, 42, 0.7);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
