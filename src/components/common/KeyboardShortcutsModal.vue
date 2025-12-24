<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import { getShortcutGroups } from '@/config/keyboardShortcuts'
import { showKeyboardHelp } from '@/composables/useKeyboardShortcuts'

const shortcutGroups = computed(() => getShortcutGroups())

const closeModal = () => {
  showKeyboardHelp.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="showKeyboardHelp"
    header="Keyboard Shortcuts"
    modal
    dismissableMask
    :closable="true"
    :style="{ width: '500px', maxWidth: '95vw' }"
    :pt="{
      root: { class: 'keyboard-shortcuts-dialog' },
      mask: { class: 'backdrop-blur-sm bg-black/70' },
      header: { class: '!bg-zinc-900 !text-white !border-b !border-zinc-700' },
      content: { class: '!bg-zinc-900 !p-0' },
      closeButton: { class: '!text-white hover:!bg-zinc-700' }
    }"
    @hide="closeModal"
  >
    <div class="max-h-[60vh] overflow-y-auto">
      <div
        v-for="group in shortcutGroups"
        :key="group.name"
        class="border-b border-zinc-800 last:border-b-0"
      >
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 bg-zinc-800/50">
          {{ group.name }}
        </h3>
        <div class="divide-y divide-zinc-800/50">
          <div
            v-for="shortcut in group.shortcuts"
            :key="shortcut.action"
            class="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/30"
          >
            <span class="text-gray-300">{{ shortcut.description }}</span>
            <div class="flex gap-1">
              <kbd
                v-for="(key, index) in shortcut.key.split(' / ')"
                :key="index"
                class="px-2 py-1 text-xs font-mono bg-zinc-700 text-gray-200 rounded border border-zinc-600"
              >
                {{ key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 py-3 bg-zinc-800/50 border-t border-zinc-700">
      <p class="text-xs text-gray-500 text-center">
        Press <kbd class="px-1.5 py-0.5 text-xs font-mono bg-zinc-700 text-gray-300 rounded">?</kbd> to toggle this help
      </p>
    </div>
  </Dialog>
</template>

<style>
.keyboard-shortcuts-dialog .p-dialog-header {
  padding: 1rem 1.25rem;
}

.keyboard-shortcuts-dialog .p-dialog-content {
  padding: 0;
}
</style>
