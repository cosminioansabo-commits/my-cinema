<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useListsStore } from '@/stores/listsStore'
import { getImageUrl } from '@/services/tmdbService'
import type { MediaListItem } from '@/types'
import MediaCarousel from '@/components/media/MediaCarousel.vue'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

const route = useRoute()
const router = useRouter()
const listsStore = useListsStore()

const listId = computed(() => route.params.id as string)
const list = computed(() => listsStore.getListById(listId.value))

const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const editName = ref('')
const editDescription = ref('')

const itemMenuRef = ref<InstanceType<typeof Menu>>()
const selectedItem = ref<MediaListItem | null>(null)

// Convert list items to Media format for carousel
const listItemsAsMedia = computed(() => {
  if (!list.value) return []
  return list.value.items.map(item => ({
    id: item.mediaId,
    title: item.title,
    posterPath: item.posterPath,
    releaseDate: item.releaseDate,
    voteAverage: item.voteAverage,
    mediaType: item.mediaType,
    overview: '',
    backdropPath: null,
    voteCount: 0,
    genreIds: [],
    popularity: 0,
  }))
})

const openItemMenu = (event: Event, item: MediaListItem) => {
  selectedItem.value = item
  itemMenuRef.value?.toggle(event)
}

const itemMenuItems = computed(() => {
  if (!selectedItem.value || !list.value) return []

  const items = [
    {
      label: 'View Details',
      icon: 'pi pi-eye',
      command: () => {
        router.push(`/media/${selectedItem.value!.mediaType}/${selectedItem.value!.mediaId}`)
      },
    },
    {
      label: selectedItem.value.watchedAt ? 'Mark as Unwatched' : 'Mark as Watched',
      icon: selectedItem.value.watchedAt ? 'pi pi-eye-slash' : 'pi pi-check',
      command: () => {
        if (!selectedItem.value!.watchedAt) {
          listsStore.markAsWatched(list.value!.id, selectedItem.value!.mediaId, selectedItem.value!.mediaType)
        }
      },
    },
    { separator: true },
    {
      label: 'Remove from List',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: () => {
        listsStore.removeFromList(list.value!.id, selectedItem.value!.mediaId, selectedItem.value!.mediaType)
      },
    },
  ]

  // Add move to other lists
  const otherLists = listsStore.lists.filter(l => l.id !== list.value!.id)
  if (otherLists.length > 0) {
    items.splice(2, 0, {
      label: 'Move to...',
      icon: 'pi pi-arrow-right',
      items: otherLists.map(l => ({
        label: l.name,
        icon: `pi ${l.icon}`,
        command: () => {
          listsStore.moveToList(list.value!.id, l.id, selectedItem.value!.mediaId, selectedItem.value!.mediaType)
        },
      })),
    } as any)
  }

  return items
})

const openEditModal = () => {
  if (!list.value) return
  editName.value = list.value.name
  editDescription.value = list.value.description || ''
  showEditModal.value = true
}

const saveEdit = () => {
  if (!list.value || list.value.isDefault) return
  listsStore.updateList(list.value.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim() || undefined,
  })
  showEditModal.value = false
}

const deleteList = () => {
  if (!list.value || list.value.isDefault) return
  listsStore.deleteList(list.value.id)
  router.push('/my-lists')
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div v-if="list" class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div class="flex items-center gap-4">
        <RouterLink
          to="/my-lists"
          class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <i class="pi pi-arrow-left"></i>
        </RouterLink>
        <div
          class="w-14 h-14 rounded-lg flex items-center justify-center"
          :style="{ backgroundColor: list.color }"
        >
          <i :class="['pi', list.icon, 'text-2xl text-white']"></i>
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">{{ list.name }}</h1>
          <p class="text-gray-400 text-sm">{{ list.items.length }} {{ list.items.length === 1 ? 'item' : 'items' }}</p>
        </div>
      </div>

      <div v-if="!list.isDefault" class="flex gap-2">
        <Button
          icon="pi pi-pencil"
          severity="secondary"
          rounded
          @click="openEditModal"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          rounded
          outlined
          @click="showDeleteConfirm = true"
        />
      </div>
    </div>

    <!-- Description -->
    <p v-if="list.description" class="text-gray-400 mb-8 max-w-2xl">
      {{ list.description }}
    </p>

    <!-- Items Grid -->
    <div v-if="list.items.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      <div
        v-for="item in list.items"
        :key="`${item.mediaType}-${item.mediaId}`"
        class="group relative bg-[#181818] rounded-md overflow-hidden"
      >
        <RouterLink :to="`/media/${item.mediaType}/${item.mediaId}`">
          <div class="aspect-[2/3] relative overflow-hidden">
            <img
              :src="getImageUrl(item.posterPath, 'w300')"
              :alt="item.title"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />

            <!-- Watched badge -->
            <div
              v-if="item.watchedAt"
              class="absolute top-2 left-2 bg-green-600/90 rounded-full px-2 py-0.5 flex items-center gap-1"
            >
              <i class="pi pi-check text-xs"></i>
              <span class="text-xs">Watched</span>
            </div>

            <!-- Rating if set -->
            <div
              v-if="item.rating"
              class="absolute top-2 right-2 rating-badge rounded px-1.5 py-0.5 flex items-center gap-1"
            >
              <i class="pi pi-star-fill text-[#f5c518] text-xs"></i>
              <span class="text-xs font-bold">{{ item.rating }}</span>
            </div>

            <!-- Hover overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="absolute bottom-0 left-0 right-0 p-3">
                <div class="flex items-center gap-2 text-xs mb-1">
                  <span class="text-green-500 font-bold">{{ Math.round(item.voteAverage * 10) }}%</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-3">
            <h3 class="font-medium text-sm text-[#e5e5e5] truncate group-hover:text-white transition-colors">
              {{ item.title }}
            </h3>
            <p class="text-xs text-gray-500 mt-0.5">{{ new Date(item.releaseDate).getFullYear() }}</p>
          </div>
        </RouterLink>

        <!-- Menu button -->
        <button
          class="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
          @click.prevent="openItemMenu($event, item)"
        >
          <i class="pi pi-ellipsis-v text-sm"></i>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 text-center">
      <div class="w-20 h-20 rounded-full bg-[#181818] flex items-center justify-center mb-6">
        <i :class="['pi', list.icon, 'text-3xl']" :style="{ color: list.color }"></i>
      </div>
      <h3 class="text-xl font-semibold text-gray-300 mb-2">This list is empty</h3>
      <p class="text-gray-500 mb-6">Start adding movies and TV shows to this list</p>
      <RouterLink to="/browse">
        <Button label="Browse Content" icon="pi pi-compass" />
      </RouterLink>
    </div>

    <!-- Item Context Menu -->
    <Menu ref="itemMenuRef" :model="itemMenuItems" popup />

    <!-- Edit Modal -->
    <Dialog
      v-model:visible="showEditModal"
      modal
      header="Edit List"
      :style="{ width: '24rem' }"
      :pt="{
        root: { class: 'bg-[#1a1a1a] border border-white/10' },
        header: { class: 'bg-[#1a1a1a] text-white border-b border-white/10' },
        content: { class: 'bg-[#1a1a1a]' },
      }"
    >
      <div class="space-y-4 pt-4">
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-300">Name</label>
          <InputText v-model="editName" class="w-full" />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-gray-300">Description</label>
          <Textarea v-model="editDescription" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" text severity="secondary" @click="showEditModal = false" />
          <Button label="Save" @click="saveEdit" />
        </div>
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <Dialog
      v-model:visible="showDeleteConfirm"
      modal
      header="Delete List"
      :style="{ width: '24rem' }"
      :pt="{
        root: { class: 'bg-[#1a1a1a] border border-white/10' },
        header: { class: 'bg-[#1a1a1a] text-white border-b border-white/10' },
        content: { class: 'bg-[#1a1a1a]' },
      }"
    >
      <p class="text-gray-300">
        Are you sure you want to delete "{{ list.name }}"? This action cannot be undone.
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" text severity="secondary" @click="showDeleteConfirm = false" />
          <Button label="Delete" severity="danger" @click="deleteList" />
        </div>
      </template>
    </Dialog>
  </div>

  <!-- List not found -->
  <div v-else class="flex flex-col items-center justify-center py-20 text-center">
    <div class="w-20 h-20 rounded-full bg-[#181818] flex items-center justify-center mb-6">
      <i class="pi pi-exclamation-circle text-3xl text-gray-500"></i>
    </div>
    <h2 class="text-xl font-semibold text-gray-300 mb-2">List not found</h2>
    <RouterLink to="/my-lists">
      <Button label="Go to My Lists" severity="secondary" />
    </RouterLink>
  </div>
</template>
