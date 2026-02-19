<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Drawer from 'primevue/drawer'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import { useLanguage } from '@/composables/useLanguage'
import { useProfileStore } from '@/stores/profileStore'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()
const { t } = useLanguage()

const handleSwitchProfile = () => {
  closeSidebar()
  router.push({ name: 'profiles' })
}

const navLinks = [
  { path: '/', labelKey: 'nav.home', icon: 'pi-home' },
  { path: '/browse', labelKey: 'nav.browse', icon: 'pi-compass' },
  { path: '/search', labelKey: 'nav.search', icon: 'pi-search' },
  { path: '/my-library', labelKey: 'nav.myLibrary', icon: 'pi-database' },
  { path: '/calendar', labelKey: 'nav.calendar', icon: 'pi-calendar' },
  { path: '/notifications', labelKey: 'notifications.title', icon: 'pi-bell' },
  { path: '/downloads', labelKey: 'nav.downloads', icon: 'pi-download' },
]

const isActiveRoute = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const closeSidebar = () => {
  emit('update:visible', false)
}
</script>

<template>
  <Drawer
    :visible="props.visible"
    @update:visible="emit('update:visible', $event)"
    :showCloseIcon="false"
    class="w-80"
  >
    <template #header>
      <div class="flex items-center justify-between w-full border-b px-4 py-2 border-zinc-700">
        <RouterLink to="/" class="flex items-center gap-1 font-bold text-xl" @click="closeSidebar">
          <span class="text-[#e50914]">MY</span>
          <span class="text-white">CINEMA</span>
        </RouterLink>
        <button
          class="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors"
          @click="closeSidebar"
        >
          <i class="pi pi-times text-gray-400"></i>
        </button>
      </div>
    </template>


      <!-- Main Navigation -->
      <nav class="flex flex-col p-4 gap-2">
        <RouterLink
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="flex items-center gap-4 p-3 rounded-xl transition-all duration-200"
          :class="[
            isActiveRoute(link.path)
              ? 'bg-[#e50914] text-white shadow-lg shadow-[#e50914]/20'
              : 'text-gray-300 hover:bg-zinc-800 hover:text-white'
          ]"
          @click="closeSidebar"
        >
          <i :class="['pi', link.icon, 'text-lg']"></i>
          <span class="font-medium">{{ t(link.labelKey) }}</span>
        </RouterLink>
      </nav>

      <!-- Bottom section -->
      <div class="absolute bottom-0 left-0 right-0 border-t border-zinc-700">
        <!-- Profile Switcher -->
        <button
          v-if="profileStore.activeProfile"
          class="w-full flex items-center gap-3 p-4 hover:bg-zinc-800 transition-colors"
          @click="handleSwitchProfile"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            :style="{ backgroundColor: profileStore.activeProfile.avatarColor }"
          >
            <i :class="['pi', profileStore.activeProfile.avatarIcon, 'text-sm text-white']"></i>
          </div>
          <div class="flex-1 text-left">
            <p class="text-white text-sm font-medium">{{ profileStore.activeProfile.name }}</p>
            <p class="text-gray-500 text-xs">{{ t('profiles.switchProfile') }}</p>
          </div>
          <i class="pi pi-chevron-right text-gray-500 text-xs"></i>
        </button>
        <!-- Language Selector -->
        <div class="p-4 border-t border-zinc-700">
          <div class="flex items-center gap-3">
            <i class="pi pi-globe text-gray-400"></i>
            <span class="text-gray-400 text-sm">{{ t('settings.language') }}</span>
            <div class="ml-auto">
              <LanguageSelector />
            </div>
          </div>
        </div>
      </div>

  </Drawer>
</template>
