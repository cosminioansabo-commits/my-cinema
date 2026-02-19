<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useFiltersStore } from '@/stores/filtersStore'
import { useLanguage } from '@/composables/useLanguage'
import { getImageUrl } from '@/services/tmdbService'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import MultiSelect from 'primevue/multiselect'
import Slider from 'primevue/slider'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import ToggleSwitch from 'primevue/toggleswitch'

const filtersStore = useFiltersStore()
const { t } = useLanguage()

onMounted(() => {
  filtersStore.loadGenres()
})

const currentYear = new Date().getFullYear()

const mediaTypeOptions = computed(() => [
  { value: 'all', label: t('browse.all') },
  { value: 'movie', label: t('browse.movies') },
  { value: 'tv', label: t('browse.tvShows') },
])

const platformsWithLogos = computed(() =>
  filtersStore.streamingPlatforms.map(p => ({
    ...p,
    logo: getImageUrl(p.logo, 'w200'),
  }))
)

const selectedGenres = computed({
  get: () => filtersStore.filters.genres,
  set: (val) => filtersStore.setGenres(val),
})

const selectedPlatforms = computed({
  get: () => filtersStore.filters.platforms,
  set: (val) => filtersStore.setPlatforms(val),
})

const yearRange = computed({
  get: () => filtersStore.filters.yearRange,
  set: (val) => filtersStore.setYearRange(val as [number, number]),
})

const ratingRange = computed({
  get: () => filtersStore.filters.ratingRange,
  set: (val) => filtersStore.setRatingRange(val as [number, number]),
})
</script>

<template>
  <div class="space-y-7 p-4 sm:p-0">
    <!-- Header -->
    <div class="hidden sm:flex items-center justify-between pb-4 border-b border-zinc-700/50">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-[#e50914]/10 flex items-center justify-center">
          <i class="pi pi-filter text-[#e50914]"></i>
        </div>
        <h2 class="text-xl font-bold text-white">{{ t('browse.filters') }}</h2>
      </div>
      <Button
        v-if="filtersStore.hasActiveFilters"
        :label="t('browse.clearAll')"
        text
        size="small"
        class="text-gray-400 hover:text-white"
        @click="filtersStore.resetFilters()"
      />
    </div>

    <!-- Active filters chips -->
    <div v-if="filtersStore.hasActiveFilters" class="flex flex-wrap gap-2">
      <Chip
        v-if="filtersStore.filters.mediaType !== 'all'"
        :label="filtersStore.filters.mediaType === 'movie' ? t('browse.movies') : t('browse.tvShows')"
        removable
        class="bg-[#e50914]/20 border border-[#e50914]/30"
        @remove="filtersStore.resetFilter('mediaType')"
      />
      <Chip
        v-if="filtersStore.filters.genres.length > 0"
        :label="t('browse.nGenres', { n: filtersStore.filters.genres.length })"
        removable
        class="bg-purple-500/20 border border-purple-500/30"
        @remove="filtersStore.resetFilter('genres')"
      />
      <Chip
        v-if="filtersStore.filters.platforms.length > 0"
        :label="t('browse.nPlatforms', { n: filtersStore.filters.platforms.length })"
        removable
        class="bg-blue-500/20 border border-blue-500/30"
        @remove="filtersStore.resetFilter('platforms')"
      />
      <Chip
        v-if="filtersStore.filters.animeOnly"
        :label="t('home.anime')"
        removable
        class="bg-pink-500/20 border border-pink-500/30"
        @remove="filtersStore.resetFilter('animeOnly')"
      />
    </div>

    <!-- Media Type -->
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        <i class="pi pi-video text-xs"></i>
        {{ t('browse.type') }}
      </label>
      <SelectButton
        :modelValue="filtersStore.filters.mediaType"
        :options="mediaTypeOptions"
        optionLabel="label"
        optionValue="value"
        :allowEmpty="false"
        class="w-full"
        @update:modelValue="filtersStore.setMediaType($event as 'all' | 'movie' | 'tv')"
      />
    </div>

    <!-- Anime Toggle -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-0">
          <span class="anime-icon" :class="{ 'anime-icon-active': filtersStore.filters.animeOnly }">アニメ</span>
          {{ t('browse.animeOnly') }}
        </label>
        <ToggleSwitch
          :modelValue="filtersStore.filters.animeOnly"
          @update:modelValue="filtersStore.setAnimeOnly"
          :pt="{
            root: { class: 'w-11' },
            slider: { class: filtersStore.filters.animeOnly ? 'bg-pink-500' : 'bg-zinc-600' }
          }"
        />
      </div>
      <p class="text-xs text-gray-500 mt-2">{{ t('browse.animeOnlyHint') }}</p>
    </div>

    <!-- Genres -->
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        <i class="pi pi-tag text-xs"></i>
        {{ t('browse.genres') }}
      </label>
      <MultiSelect
        v-model="selectedGenres"
        :options="filtersStore.availableGenres"
        optionLabel="name"
        optionValue="id"
        :placeholder="t('browse.selectGenres')"
        display="chip"
        :maxSelectedLabels="3"
        class="w-full filter-input"
      />
    </div>

    <!-- Streaming Platforms -->
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        <i class="pi pi-desktop text-xs"></i>
        {{ t('browse.streamingOn') }}
      </label>
      <MultiSelect
        v-model="selectedPlatforms"
        :options="platformsWithLogos"
        optionLabel="name"
        optionValue="id"
        :placeholder="t('browse.selectPlatforms')"
        display="chip"
        :maxSelectedLabels="2"
        class="w-full filter-input"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-3">
            <img :src="option.logo" :alt="option.name" class="w-7 h-7 rounded-lg" />
            <span>{{ option.name }}</span>
          </div>
        </template>
      </MultiSelect>
    </div>

    <!-- Year Range -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between mb-3">
        <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-0">
          <i class="pi pi-calendar text-xs"></i>
          {{ t('browse.year') }}
        </label>
        <span class="text-sm font-medium text-white bg-zinc-800 px-3 py-1 rounded-lg">
          {{ yearRange[0] }} - {{ yearRange[1] }}
        </span>
      </div>
      <div class="px-1">
        <Slider
          v-model="yearRange"
          range
          :min="1900"
          :max="currentYear"
          class="w-full"
        />
      </div>
    </div>

    <!-- Rating Range -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between mb-3">
        <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-0">
          <i class="pi pi-star text-xs"></i>
          {{ t('browse.rating') }}
        </label>
        <span class="text-sm font-medium text-white bg-zinc-800 px-3 py-1 rounded-lg flex items-center gap-1">
          <i class="pi pi-star-fill text-[#f5c518] text-xs"></i>
          {{ ratingRange[0] }} - {{ ratingRange[1] }}
        </span>
      </div>
      <div class="px-1">
        <Slider
          v-model="ratingRange"
          range
          :min="0"
          :max="10"
          :step="0.5"
          class="w-full"
        />
      </div>
    </div>

    <!-- Sort By -->
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        <i class="pi pi-sort-alt text-xs"></i>
        {{ t('browse.sortBy') }}
      </label>
      <Select
        v-model="filtersStore.filters.sortBy"
        :options="filtersStore.sortOptions"
        optionLabel="label"
        optionValue="value"
        class="w-full filter-input"
      />
    </div>
  </div>
</template>

<style scoped>
.anime-icon {
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(156, 163, 175, 0.3);
  background-color: rgba(156, 163, 175, 0.1);
  transition: all 0.3s ease;
}

.anime-icon-active {
  color: #f472b6;
  border-color: rgba(244, 114, 182, 0.5);
  background-color: rgba(244, 114, 182, 0.15);
}
</style>
