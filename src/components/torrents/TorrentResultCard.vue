<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { TorrentResult } from '@/types/torrent'

const props = defineProps<{
  torrent: TorrentResult
  loading?: boolean
}>()

const emit = defineEmits<{
  download: [torrent: TorrentResult]
}>()

// Parse torrent name to extract show title, season, episode info
const parsedInfo = computed(() => {
  let name = props.torrent.name
  // Remove indexer suffix like [FileList.io]
  name = name.replace(/\s*\[.*?\]\s*$/, '')

  // Try to extract season and episode info
  // Patterns: S01E02, S01.E02, Season 1 Episode 2, etc.
  const seasonEpisodeMatch = name.match(/[.\s]S(\d{1,2})E(\d{1,2})/i)
  const seasonOnlyMatch = name.match(/[.\s]S(\d{1,2})(?![E\d])/i)
  const completeMatch = name.match(/complete|full.?series|all.?seasons/i)

  let title = name
  let season: number | null = null
  let episode: number | null = null
  let isComplete = false

  if (seasonEpisodeMatch) {
    season = parseInt(seasonEpisodeMatch[1])
    episode = parseInt(seasonEpisodeMatch[2])
    // Get title before the season/episode marker
    title = name.substring(0, seasonEpisodeMatch.index || 0)
  } else if (seasonOnlyMatch) {
    season = parseInt(seasonOnlyMatch[1])
    // Get title before the season marker
    title = name.substring(0, seasonOnlyMatch.index || 0)
  } else if (completeMatch) {
    isComplete = true
    title = name.substring(0, completeMatch.index || 0)
  }

  // Clean up title: replace dots and underscores with spaces, remove quality markers
  title = title
    .replace(/\./g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*(1080p|2160p|720p|480p|4K|UHD|HDR|BluRay|WEB-DL|WEBRip|HDTV|BRRip|DVDRip).*$/i, '')
    .trim()

  // Extract codec/format info for subtitle
  const codecMatch = name.match(/(x264|x265|H\.?264|H\.?265|HEVC|AVC|DDP?5\.1|Atmos|TrueHD)/i)
  const sourceMatch = name.match(/(BluRay|WEB-DL|WEBRip|HDTV|BRRip|NF|AMZN|DSNP|HMAX)/i)

  let formatInfo = ''
  if (sourceMatch) formatInfo = sourceMatch[1].toUpperCase()
  if (codecMatch) formatInfo += formatInfo ? ` ${codecMatch[1]}` : codecMatch[1]

  return { title, season, episode, isComplete, formatInfo }
})

// Extract source/indexer from name
const indexer = computed(() => {
  const match = props.torrent.name.match(/\[([^\]]+)\]\s*$/)
  return match ? match[1] : props.torrent.source.toUpperCase()
})

const is4K = computed(() => {
  const q = props.torrent.quality?.toLowerCase()
  return q?.includes('2160') || q?.includes('4k')
})

const qualityClass = computed(() => {
  const q = props.torrent.quality?.toLowerCase()
  if (q?.includes('2160') || q?.includes('4k')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  if (q?.includes('1080')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (q?.includes('720')) return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
})

const seedsClass = computed(() => {
  const seeds = props.torrent.seeds
  if (seeds >= 100) return 'text-green-400'
  if (seeds >= 20) return 'text-yellow-400'
  return 'text-red-400'
})
</script>

<template>
  <div class="torrent-card">
    <div class="flex items-center gap-2 sm:gap-3">
      <!-- Quality Badge -->
      <div class="quality-badge" :class="qualityClass">
        <span v-if="is4K">4K</span>
        <span v-else>{{ torrent.quality || '?' }}</span>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <!-- Title -->
        <h4 class="torrent-title">{{ parsedInfo.title }}</h4>

        <!-- Season/Episode Tags -->
        <div class="tag-row">
          <Tag
            v-if="parsedInfo.isComplete"
            value="Complete"
            severity="success"
            class="torrent-tag"
          />
          <Tag
            v-else-if="parsedInfo.season"
            :value="`S${String(parsedInfo.season).padStart(2, '0')}`"
            severity="info"
            class="torrent-tag"
          />
          <Tag
            v-if="parsedInfo.episode"
            :value="`E${String(parsedInfo.episode).padStart(2, '0')}`"
            severity="secondary"
            class="torrent-tag"
          />
          <Tag
            v-if="parsedInfo.formatInfo"
            :value="parsedInfo.formatInfo"
            severity="contrast"
            class="torrent-tag"
          />
        </div>

        <!-- Meta info -->
        <div class="meta-row">
          <span class="meta-item text-gray-500">
            <i class="pi pi-server"></i>{{ indexer }}
          </span>
          <span class="meta-item text-gray-400">
            <i class="pi pi-database"></i>{{ torrent.size }}
          </span>
          <span class="meta-item" :class="seedsClass">
            <i class="pi pi-arrow-up"></i>{{ torrent.seeds }}
          </span>
          <span class="meta-item text-gray-500">
            <i class="pi pi-arrow-down"></i>{{ torrent.peers }}
          </span>
        </div>
      </div>

      <!-- Download Button -->
      <Button
        icon="pi pi-download"
        severity="success"
        rounded
        :loading="loading"
        @click="emit('download', torrent)"
        aria-label="Download"
        class="download-btn"
      />
    </div>
  </div>
</template>

<style scoped>
.torrent-card {
  background: #1e1e1e;
  border-radius: 10px;
  padding: 0.625rem;
  transition: background 0.15s ease;
  border: 1px solid transparent;
}

@media (min-width: 640px) {
  .torrent-card {
    padding: 0.875rem;
    border-radius: 12px;
  }
}

.torrent-card:hover {
  background: #252525;
  border-color: #333;
}

.quality-badge {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.625rem;
  border-width: 1px;
}

@media (min-width: 640px) {
  .quality-badge {
    width: 3rem;
    height: 3rem;
    font-size: 0.6875rem;
  }
}

.torrent-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (min-width: 640px) {
  .torrent-title {
    font-size: 0.8125rem;
    -webkit-line-clamp: 2;
  }
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.375rem;
}

.torrent-tag {
  font-size: 0.5625rem !important;
  padding: 0.125rem 0.375rem !important;
  line-height: 1.2 !important;
}

@media (min-width: 640px) {
  .torrent-tag {
    font-size: 0.625rem !important;
    padding: 0.1875rem 0.5rem !important;
  }
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

@media (min-width: 640px) {
  .meta-row {
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  font-size: 0.625rem;
}

@media (min-width: 640px) {
  .meta-item {
    font-size: 0.6875rem;
    gap: 0.25rem;
  }
}

.meta-item i {
  font-size: 0.5625rem;
}

@media (min-width: 640px) {
  .meta-item i {
    font-size: 0.625rem;
  }
}

.download-btn {
  flex-shrink: 0;
  width: 2rem !important;
  height: 2rem !important;
}

@media (min-width: 640px) {
  .download-btn {
    width: 2.5rem !important;
    height: 2.5rem !important;
  }
}
</style>
