<script setup lang="ts">
import { computed } from 'vue'
import { useListsStore } from '@/stores/listsStore'
import type { Media } from '@/types'
import Menu from 'primevue/menu'
import Button from 'primevue/button'

const props = defineProps<{
  media: Media
}>()

const listsStore = useListsStore()

const menuRef = defineModel<InstanceType<typeof Menu>>()

const menuItems = computed(() => {
  const items = listsStore.lists.map(list => {
    const isInList = listsStore.isInList(list.id, props.media.id, props.media.mediaType)
    return {
      label: list.name,
      icon: isInList ? 'pi pi-check' : `pi ${list.icon}`,
      style: { color: list.color },
      command: () => {
        if (isInList) {
          listsStore.removeFromList(list.id, props.media.id, props.media.mediaType)
        } else {
          listsStore.addToList(list.id, props.media)
        }
      },
    }
  })

  return items
})

const toggleMenu = (event: Event) => {
  menuRef.value?.toggle(event)
}
</script>

<template>
  <div>
    <Button
      icon="pi pi-plus"
      label="Add to List"
      severity="secondary"
      @click="toggleMenu"
    />
    <Menu
      ref="menuRef"
      :model="menuItems"
      popup
    />
  </div>
</template>
