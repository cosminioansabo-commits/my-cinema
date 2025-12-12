<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useMediaStore } from '@/stores/mediaStore'
import { useFiltersStore } from '@/stores/filtersStore'
import MediaGrid from '@/components/media/MediaGrid.vue'
import MediaFilters from '@/components/media/MediaFilters.vue'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'

const mediaStore = useMediaStore()
const filtersStore = useFiltersStore()

const showMobileFilters = ref(false)

onMounted(async () => {
  await filtersStore.loadGenres()
  mediaStore.browse()
})

// Watch for filter changes and refetch
watch(
  () => filtersStore.filters,
  () => {
    mediaStore.browse()
  },
  { deep: true }
)

const loadMore = () => {
  mediaStore.loadMoreBrowseResults()
}

const hasMore = () => {
  return mediaStore.currentPage < mediaStore.totalPages
}
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Desktop Filters Sidebar -->
    <aside class="hidden lg:block w-80 flex-shrink-0">
      <div class="sticky top-28 bg-zinc-900/80 backdrop-blur-md rounded-2xl p-6 border border-zinc-800/50 shadow-xl shadow-black/20">
        <MediaFilters />
      </div>
    </aside>

    <!-- Mobile Filter Button -->
    <div class="lg:hidden fixed bottom-6 right-6 z-40">
      <Button
        icon="pi pi-filter"
        rounded
        size="large"
        :badge="filtersStore.activeFilterCount > 0 ? String(filtersStore.activeFilterCount) : undefined"
        badgeSeverity="contrast"
        @click="showMobileFilters = true"
      />
    </div>

    <!-- Mobile Filters Drawer -->
    <Drawer
      v-model:visible="showMobileFilters"
      position="bottom"
      :style="{ height: '80vh' }"
      :pt="{
        root: { class: 'bg-zinc-900' },
        header: { class: 'bg-zinc-900 border-b border-zinc-700' },
        content: { class: 'bg-zinc-900 p-4' },
      }"
    >
      <template #header>
        <div class="flex items-center justify-between w-full">
          <h2 class="text-lg font-semibold">Filters</h2>
          <Button
            label="Apply"
            size="small"
            @click="showMobileFilters = false"
          />
        </div>
      </template>
      <MediaFilters />
    </Drawer>

    <!-- Main Content -->
    <main class="flex-1 min-w-0">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Browse</h1>
          <p class="text-gray-400 text-sm mt-1">
            {{ mediaStore.totalResults.toLocaleString() }} results
          </p>
        </div>
      </div>

      <MediaGrid
        :items="mediaStore.browseResults"
        :loading="mediaStore.isLoadingBrowse && mediaStore.browseResults.length === 0"
      />

      <!-- Load More -->
      <div
        v-if="hasMore() && !mediaStore.isLoadingBrowse"
        class="flex justify-center mt-8"
      >
        <Button
          label="Load More"
          icon="pi pi-arrow-down"
          severity="secondary"
          outlined
          @click="loadMore"
        />
      </div>

      <!-- Loading indicator for load more -->
      <div
        v-if="mediaStore.isLoadingBrowse && mediaStore.browseResults.length > 0"
        class="flex justify-center mt-8"
      >
        <i class="pi pi-spin pi-spinner text-2xl text-purple-500"></i>
      </div>
    </main>
  </div>
</template>
