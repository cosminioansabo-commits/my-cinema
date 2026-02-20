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
    modal
    dismissableMask
    :closable="false"
    :pt="{
      root: { class: 'shortcuts-dialog' },
      mask: { class: 'shortcuts-mask' },
      content: { class: 'shortcuts-content' },
      header: { class: '!hidden' },
    }"
    @hide="closeModal"
  >
    <!-- Header -->
    <div class="shortcuts-header">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center ring-1 ring-purple-500/20">
          <i class="pi pi-bolt text-purple-400 text-sm"></i>
        </div>
        <div>
          <h2 class="text-white text-base font-semibold tracking-tight">Keyboard Shortcuts</h2>
          <p class="text-zinc-500 text-xs mt-0.5">Navigate faster with keyboard</p>
        </div>
      </div>
      <button
        class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
        @click="closeModal"
      >
        <i class="pi pi-times text-sm"></i>
      </button>
    </div>

    <!-- Shortcut Groups -->
    <div class="shortcuts-body">
      <div
        v-for="group in shortcutGroups"
        :key="group.name"
        class="mb-5 last:mb-0"
      >
        <h3 class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-2.5">
          {{ group.name }}
        </h3>
        <div class="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] overflow-hidden">
          <div
            v-for="(shortcut, index) in group.shortcuts"
            :key="shortcut.action"
            class="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
            :class="index < group.shortcuts.length - 1 ? 'border-b border-white/[0.04]' : ''"
          >
            <span class="text-zinc-300 text-sm">{{ shortcut.description }}</span>
            <div class="flex items-center gap-1.5">
              <kbd
                v-for="(key, keyIndex) in shortcut.key.split(' / ')"
                :key="keyIndex"
                class="shortcuts-kbd"
              >
                {{ key }}
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="shortcuts-footer">
      <div class="flex items-center justify-center gap-4 text-[11px] text-zinc-600">
        <span class="flex items-center gap-1.5">
          <kbd class="shortcuts-kbd-sm">?</kbd>
          <span>toggle</span>
        </span>
        <span class="flex items-center gap-1.5">
          <kbd class="shortcuts-kbd-sm">Esc</kbd>
          <span>close</span>
        </span>
      </div>
    </div>
  </Dialog>
</template>

<style>
/* ── Mask backdrop ── */
.shortcuts-mask {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  background: rgba(0, 0, 0, 0.5) !important;
}

/* ── Dialog shell ── */
.shortcuts-dialog.p-dialog {
  width: 95vw !important;
  max-width: 520px !important;
  margin-top: 10vh !important;
  margin-bottom: auto !important;
  border-radius: 16px !important;
  border: none !important;
  overflow: hidden !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 24px 60px -12px rgba(0, 0, 0, 0.75),
    0 0 80px -20px rgba(139, 92, 246, 0.08) !important;
  animation: shortcuts-enter 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.shortcuts-dialog .p-dialog-header {
  display: none !important;
}

.shortcuts-dialog .p-dialog-content {
  background: rgba(24, 24, 27, 0.97) !important;
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  padding: 0 !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
}

/* ── Header ── */
.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* ── Scrollable body ── */
.shortcuts-body {
  max-height: 55vh;
  overflow-y: auto;
  padding: 16px 20px;
  overscroll-behavior: contain;
}

.shortcuts-body::-webkit-scrollbar {
  width: 4px;
}

.shortcuts-body::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* ── Footer ── */
.shortcuts-footer {
  padding: 10px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(24, 24, 27, 0.6);
}

/* ── Kbd badges ── */
.shortcuts-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  padding: 3px 8px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #a1a1aa;
  background: rgba(39, 39, 42, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.5);
  border-radius: 6px;
  line-height: 1.4;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.shortcuts-kbd-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 500;
  color: #52525b;
  background: rgba(39, 39, 42, 0.8);
  border: 1px solid rgba(63, 63, 70, 0.4);
  border-radius: 4px;
  line-height: 1.5;
}

/* ── Entry animation ── */
@keyframes shortcuts-enter {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
