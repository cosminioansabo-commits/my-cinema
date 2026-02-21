<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useHomeContent } from '@/composables/useHomeContent'
import { useLanguage } from '@/composables/useLanguage'
import MediaCarousel from '@/components/media/MediaCarousel.vue'
import ContinueWatchingCarousel from '@/components/media/ContinueWatchingCarousel.vue'
import { useRecentlyViewed } from '@/composables/useRecentlyViewed'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'

const authStore = useAuthStore()
const { languageChangeCounter, t } = useLanguage()
const { recentlyViewed } = useRecentlyViewed()

// Convert recently viewed items to Media-like objects for MediaCarousel
const recentlyViewedMedia = computed(() =>
  recentlyViewed.value.map((item) => ({
    id: item.id,
    title: item.title,
    posterPath: item.posterPath,
    releaseDate: '',
    voteAverage: 0,
    mediaType: item.mediaType as 'movie' | 'tv',
    overview: '',
    backdropPath: null,
    voteCount: 0,
    genreIds: [],
    popularity: 0,
  }))
)

const {
  // Hero
  featuredItem,
  isLoadingHero,
  heroBackdrop,
  heroYear,
  heroRating,
  // Error
  contentError,
  // Primary content
  trendingAll,
  popularMovies,
  popularTV,
  topRatedMovies,
  topRatedTV,
  nowPlaying,
  isLoadingContent,
  // Secondary content
  upcomingMovies,
  onTheAirTV,
  criticallyAcclaimedMovies,
  hiddenGemsMovies,
  newReleasesMovies,
  animeTV,
  actionMovies,
  sciFiMovies,
  crimeTV,
  comedyMovies,
  horrorMovies,
  documentaries,
  kDramas,
  isLoadingMoreContent,
  // Library
  libraryItems,
  continueWatchingItems,
  isLoadingContinueWatching,
  // Methods
  loadContinueWatching,
  loadAllContent,
} = useHomeContent()

onMounted(() => {
  loadAllContent(authStore.isAuthenticated)
})

// Refetch content when language changes
watch(languageChangeCounter, () => {
  loadAllContent(authStore.isAuthenticated)
})
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="relative h-[55vh] sm:h-[65vh] md:h-[70vh] min-h-[380px] sm:min-h-[450px] md:min-h-[500px] max-h-[800px] full-bleed overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0">
        <template v-if="isLoadingHero">
          <div class="w-full h-full bg-[#141414]">
            <Skeleton width="100%" height="100%" />
          </div>
        </template>
        <template v-else-if="featuredItem">
          <img
            :src="heroBackdrop"
            :alt="featuredItem.title"
            class="w-full h-full object-cover object-top"
          />
          <!-- Gradients -->
          <div class="absolute inset-0 hero-gradient"></div>
          <div class="absolute inset-0 hero-gradient-bottom"></div>
        </template>
      </div>

      <!-- Content -->
      <div class="relative h-full flex items-center">
        <div class="w-full h-full max-w-3xl justify-end flex flex-col px-4 pb-4 sm:pb-10">
          <template v-if="isLoadingHero">
            <Skeleton width="60%" height="2rem" class="mb-2 sm:mb-4" />
            <Skeleton width="40%" height="1.25rem" class="mb-4 sm:mb-4" />
            <Skeleton width="100%" height="3rem" class="mb-4 sm:mb-6" />
            <div class="flex gap-2 sm:gap-3">
              <Skeleton width="100px" height="36px" class="sm:!w-[120px] sm:!h-12" />
              <Skeleton width="100px" height="36px" class="sm:!w-[140px] sm:!h-12" />
            </div>
          </template>

          <template v-else-if="featuredItem">
            <!-- Title -->
            <h1 class="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-shadow mb-2 sm:mb-4">
              {{ featuredItem.title }}
            </h1>

            <!-- Meta -->
            <div class="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
              <span class="text-green-500 font-bold">{{ heroRating }}% Match</span>
              <span class="text-gray-300">{{ heroYear }}</span>
              <span class="px-1 sm:px-1.5 border border-gray-500 text-gray-400 text-[10px] sm:text-xs">{{ t('media.hd') }}</span>
              <span class="px-1.5 sm:px-2 py-0.5 bg-[#e50914] text-white text-[10px] sm:text-xs font-medium rounded">
                {{ featuredItem.mediaType === 'movie' ? t('media.movie') : t('media.series') }}
              </span>
            </div>

            <!-- Overview -->
            <p class="text-sm sm:text-base md:text-lg text-gray-200 line-clamp-2 sm:line-clamp-3 mb-4 sm:mb-6 max-w-2xl text-shadow">
              {{ featuredItem.overview }}
            </p>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 sm:gap-3">
              <RouterLink :to="`/media/${featuredItem.mediaType}/${featuredItem.id}`">
                <Button
                  :label="t('media.moreInfo')"
                  icon="pi pi-info-circle"
                  class="!bg-white/30 !border-0 hover:!bg-white/20 !text-white font-semibold !text-xs sm:!text-sm !py-2 sm:!py-2.5 !px-3 sm:!px-4"
                />
              </RouterLink>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- Error State -->
    <div v-if="contentError" class="flex flex-col items-center justify-center py-20 px-4 text-center">
      <i class="pi pi-exclamation-triangle text-4xl text-zinc-500 mb-4"></i>
      <p class="text-lg text-zinc-300 mb-2">{{ t('home.loadFailed') }}</p>
      <p class="text-sm text-zinc-500 mb-6">{{ t('home.loadFailedHint') }}</p>
      <Button
        :label="t('common.retry')"
        icon="pi pi-refresh"
        class="!bg-purple-600 hover:!bg-purple-700 !border-0"
        @click="loadAllContent(authStore.isAuthenticated)"
      />
    </div>

    <!-- Carousels -->
    <div v-else class="relative flex flex-col gap-4 sm:gap-10 z-10 pb-8 sm:pb-12">
      <!-- Continue Watching (if has items) -->
      <ContinueWatchingCarousel
        v-if="continueWatchingItems.length > 0 || isLoadingContinueWatching"
        :title="t('home.continueWatching')"
        :items="continueWatchingItems"
        :loading="isLoadingContinueWatching"
        @refresh="loadContinueWatching"
      />

      <!-- My Library (if has items) -->
      <MediaCarousel
        v-if="libraryItems.length > 0"
        :title="t('home.myLibrary')"
        :items="libraryItems"
        see-all-link="/my-library"
      />

      <!-- Recently Viewed -->
      <MediaCarousel
        v-if="recentlyViewedMedia.length > 0"
        :title="t('home.recentlyViewed')"
        :items="recentlyViewedMedia"
      />

      <!-- Trending Now -->
      <MediaCarousel
        :title="t('home.trending')"
        :items="trendingAll"
        :loading="isLoadingContent"
        see-all-link="/browse"
      />

      <!-- New Releases -->
      <MediaCarousel
        v-if="newReleasesMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.newReleases')"
        :items="newReleasesMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Popular Movies -->
      <MediaCarousel
        :title="t('home.popularMovies')"
        :items="popularMovies"
        :loading="isLoadingContent"
        see-all-link="/browse?type=movie"
      />

      <!-- Popular TV Shows -->
      <MediaCarousel
        :title="t('home.popularTV')"
        :items="popularTV"
        :loading="isLoadingContent"
        see-all-link="/browse?type=tv"
      />

      <!-- Critically Acclaimed -->
      <MediaCarousel
        v-if="criticallyAcclaimedMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.criticallyAcclaimed')"
        :items="criticallyAcclaimedMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Now Playing in Theaters -->
      <MediaCarousel
        :title="t('home.nowPlaying')"
        :items="nowPlaying"
        :loading="isLoadingContent"
      />

      <!-- Coming Soon -->
      <MediaCarousel
        v-if="upcomingMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.comingSoon')"
        :items="upcomingMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Currently Airing TV -->
      <MediaCarousel
        v-if="onTheAirTV.length > 0 || isLoadingMoreContent"
        :title="t('home.currentlyAiring')"
        :items="onTheAirTV"
        :loading="isLoadingMoreContent"
      />

      <!-- Action & Adventure -->
      <MediaCarousel
        v-if="actionMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.actionAdventure')"
        :items="actionMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Sci-Fi & Fantasy -->
      <MediaCarousel
        v-if="sciFiMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.sciFiFantasy')"
        :items="sciFiMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Crime & Thriller TV -->
      <MediaCarousel
        v-if="crimeTV.length > 0 || isLoadingMoreContent"
        :title="t('home.crimeThriller')"
        :items="crimeTV"
        :loading="isLoadingMoreContent"
      />

      <!-- Comedy -->
      <MediaCarousel
        v-if="comedyMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.comedy')"
        :items="comedyMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Horror -->
      <MediaCarousel
        v-if="horrorMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.horror')"
        :items="horrorMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Anime -->
      <MediaCarousel
        v-if="animeTV.length > 0 || isLoadingMoreContent"
        :title="t('home.anime')"
        :items="animeTV"
        :loading="isLoadingMoreContent"
      />

      <!-- K-Dramas -->
      <MediaCarousel
        v-if="kDramas.length > 0 || isLoadingMoreContent"
        :title="t('home.kDramas')"
        :items="kDramas"
        :loading="isLoadingMoreContent"
      />

      <!-- Top Rated Movies -->
      <MediaCarousel
        :title="t('home.topRatedMovies')"
        :items="topRatedMovies"
        :loading="isLoadingContent"
      />

      <!-- Top Rated TV Shows -->
      <MediaCarousel
        :title="t('home.topRatedTV')"
        :items="topRatedTV"
        :loading="isLoadingContent"
      />

      <!-- Hidden Gems -->
      <MediaCarousel
        v-if="hiddenGemsMovies.length > 0 || isLoadingMoreContent"
        :title="t('home.hiddenGems')"
        :items="hiddenGemsMovies"
        :loading="isLoadingMoreContent"
      />

      <!-- Documentaries -->
      <MediaCarousel
        v-if="documentaries.length > 0 || isLoadingMoreContent"
        :title="t('home.documentaries')"
        :items="documentaries"
        :loading="isLoadingMoreContent"
      />
    </div>
  </div>
</template>
