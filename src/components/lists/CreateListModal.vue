<script setup lang="ts">
import { ref, watch } from 'vue'
import { useListsStore } from '@/stores/listsStore'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [listId: string]
}>()

const listsStore = useListsStore()

const name = ref('')
const description = ref('')
const selectedIcon = ref('pi-list')
const selectedColor = ref('#6b7280')

const icons = [
  'pi-list',
  'pi-heart',
  'pi-star',
  'pi-bookmark',
  'pi-flag',
  'pi-tag',
  'pi-folder',
  'pi-video',
]

const colors = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    // Reset form
    name.value = ''
    description.value = ''
    selectedIcon.value = 'pi-list'
    selectedColor.value = '#6b7280'
  }
})

const handleCreate = () => {
  if (!name.value.trim()) return

  const newList = listsStore.createList(
    name.value.trim(),
    description.value.trim() || undefined,
    selectedIcon.value,
    selectedColor.value
  )

  emit('created', newList.id)
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="props.visible"
    @update:visible="emit('update:visible', $event)"
    modal
    header="Create New List"
    :style="{ width: '28rem' }"
  >
    <div class="space-y-4 pt-4">
      <!-- Name -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-300">Name *</label>
        <InputText
          v-model="name"
          placeholder="My awesome list"
          class="w-full"
          autofocus
        />
      </div>

      <!-- Description -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-300">Description</label>
        <Textarea
          v-model="description"
          placeholder="What's this list about?"
          rows="2"
          class="w-full"
        />
      </div>

      <!-- Icon -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-300">Icon</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="icon in icons"
            :key="icon"
            type="button"
            class="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
            :class="[
              selectedIcon === icon
                ? 'ring-2 ring-purple-500 bg-purple-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700'
            ]"
            @click="selectedIcon = icon"
          >
            <i :class="['pi', icon]" :style="{ color: selectedColor }"></i>
          </button>
        </div>
      </div>

      <!-- Color -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-gray-300">Color</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="color in colors"
            :key="color"
            type="button"
            class="w-8 h-8 rounded-full transition-all"
            :class="[
              selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white' : ''
            ]"
            :style="{ backgroundColor: color }"
            @click="selectedColor = color"
          ></button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancel"
          text
          severity="secondary"
          @click="emit('update:visible', false)"
        />
        <Button
          label="Create List"
          :disabled="!name.trim()"
          @click="handleCreate"
        />
      </div>
    </template>
  </Dialog>
</template>
