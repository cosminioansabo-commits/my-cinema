<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore, type Profile } from '@/stores/profileStore'
import { useAuthStore } from '@/stores/authStore'
import { useLanguage } from '@/composables/useLanguage'
import { getPrimaryColor } from '@/config/avatarOptions'
import ProfileAvatar from '@/components/profile/ProfileAvatar.vue'
import IconPicker from '@/components/profile/IconPicker.vue'
import ColorPicker from '@/components/profile/ColorPicker.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useLanguage()

const isManaging = ref(false)
const showCreateDialog = ref(false)
const newProfileName = ref('')
const selectedColor = ref('#e50914')
const selectedIcon = ref('pi-user')
const isCreating = ref(false)
const hoveredColor = ref<string | null>(null)

onMounted(async () => {
  await profileStore.fetchProfiles()
})

async function handleSelectProfile(profile: Profile) {
  if (isManaging.value) return
  const success = await profileStore.selectProfile(profile.id)
  if (success) {
    router.push('/')
  }
}

async function handleCreateProfile() {
  if (!newProfileName.value.trim()) return
  isCreating.value = true
  const profile = await profileStore.createProfile(
    newProfileName.value.trim(),
    selectedColor.value,
    selectedIcon.value
  )
  isCreating.value = false
  if (profile) {
    showCreateDialog.value = false
    newProfileName.value = ''
    selectedColor.value = '#e50914'
    selectedIcon.value = 'pi-user'
    toast.add({
      severity: 'success',
      summary: t('profiles.profileCreated'),
      detail: t('profiles.profileCreatedDetail', { name: profile.name }),
      life: 3000
    })
  }
}

function openCreateDialog() {
  newProfileName.value = ''
  selectedColor.value = '#e50914'
  selectedIcon.value = 'pi-user'
  profileStore.error = null
  showCreateDialog.value = true
}

function handleManageProfile(profile: Profile) {
  router.push({ name: 'profile-manage', params: { id: profile.id } })
}

function handleLogout() {
  authStore.logout()
  router.push({ name: 'login' })
}

function glowColor(): string {
  return hoveredColor.value ? getPrimaryColor(hoveredColor.value) : '#e50914'
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-[#141414] p-6">
    <div class="fixed inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#141414] to-[#0f0f0f] z-0"></div>
    <!-- Reactive ambient glow -->
    <div
      class="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] z-0 pointer-events-none transition-colors duration-700"
      :style="{ backgroundColor: glowColor() + '08' }"
    ></div>

    <div class="relative z-10 w-full max-w-3xl profile-select-enter">
      <!-- Logo -->
      <div class="text-center mb-10">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#e50914] to-[#b20710] flex items-center justify-center shadow-lg shadow-[#e50914]/25 ring-1 ring-white/10">
          <i class="pi pi-play text-3xl text-white"></i>
        </div>
        <h1 class="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">{{ t('profiles.whoIsWatching') }}</h1>
      </div>

      <!-- Loading -->
      <div v-if="profileStore.isLoading" class="flex justify-center py-12">
        <i class="pi pi-spin pi-spinner text-4xl text-gray-400"></i>
      </div>

      <!-- Profile Grid -->
      <div v-else class="flex flex-wrap justify-center gap-8 mb-8">
        <!-- Existing Profiles -->
        <button
          v-for="(profile, index) in profileStore.profiles"
          :key="profile.id"
          v-ripple
          class="group flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-200 hover:bg-white/[0.04] relative overflow-hidden profile-card-stagger"
          :class="{ 'ring-2 ring-white/30': isManaging }"
          :style="{ animationDelay: `${index * 60}ms` }"
          @click="isManaging ? handleManageProfile(profile) : handleSelectProfile(profile)"
          @mouseenter="hoveredColor = profile.avatarColor"
          @mouseleave="hoveredColor = null"
        >
          <div class="relative">
            <ProfileAvatar
              :color="profile.avatarColor"
              :icon="profile.avatarIcon"
              size="lg"
              class="group-hover:scale-105 transition-transform duration-200"
            />
            <!-- Edit overlay when managing -->
            <div
              v-if="isManaging"
              class="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center backdrop-blur-sm"
            >
              <i class="pi pi-pencil text-2xl text-white"></i>
            </div>
          </div>
          <span class="text-gray-400 text-sm sm:text-base group-hover:text-white transition-colors font-medium">
            {{ profile.name }}
          </span>
        </button>

        <!-- Add Profile Button -->
        <button
          v-if="profileStore.profileCount < 8"
          class="group flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-200 hover:bg-white/[0.04] profile-card-stagger"
          :style="{ animationDelay: `${profileStore.profiles.length * 60}ms` }"
          @click="openCreateDialog"
        >
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border-2 border-dashed border-zinc-700 group-hover:border-zinc-500 transition-all duration-200 group-hover:scale-105 bg-zinc-900/40">
            <i class="pi pi-plus text-3xl text-zinc-600 group-hover:text-zinc-400 transition-colors"></i>
          </div>
          <span class="text-zinc-500 text-sm sm:text-base group-hover:text-zinc-300 transition-colors font-medium">
            {{ t('profiles.addProfile') }}
          </span>
        </button>
      </div>

      <!-- Actions -->
      <div class="flex justify-center gap-4">
        <Button
          :label="isManaging ? t('common.close') : t('profiles.manageProfiles')"
          :severity="isManaging ? 'secondary' : 'contrast'"
          :outlined="!isManaging"
          size="small"
          @click="isManaging = !isManaging"
          class="!px-6"
        />
        <Button
          v-if="authStore.authEnabled"
          :label="t('nav.logout')"
          severity="secondary"
          outlined
          size="small"
          icon="pi pi-sign-out"
          @click="handleLogout"
          class="!px-6"
        />
      </div>
    </div>

    <!-- Create Profile Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      :header="t('profiles.addProfile')"
      modal
      :style="{ width: '36rem', maxWidth: '95vw' }"
      :pt="{
        root: { class: 'profile-dialog-root' },
        mask: { class: 'profile-dialog-mask' },
        header: { class: 'profile-dialog-header' },
        content: { class: 'profile-dialog-content' }
      }"
    >
      <div class="space-y-6 pt-2">
        <!-- Animated Preview -->
        <div class="flex justify-center">
          <ProfileAvatar
            :key="`${selectedColor}-${selectedIcon}`"
            :color="selectedColor"
            :icon="selectedIcon"
            size="xl"
            animated
          />
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.name') }}</label>
          <InputText
            v-model="newProfileName"
            :placeholder="t('profiles.namePlaceholder')"
            class="w-full !bg-zinc-800 !border-zinc-700 !text-white focus:!border-[#e50914] !rounded-lg"
            maxlength="30"
            autofocus
            @keypress.enter="handleCreateProfile"
          />
        </div>

        <!-- Color Picker -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.color') }}</label>
          <ColorPicker v-model="selectedColor" />
        </div>

        <!-- Icon Picker -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.icon') }}</label>
          <IconPicker v-model="selectedIcon" />
        </div>

        <!-- Error -->
        <div v-if="profileStore.error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p class="text-red-400 text-sm">{{ profileStore.error }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            outlined
            size="small"
            @click="showCreateDialog = false"
          />
          <Button
            :label="t('common.save')"
            :loading="isCreating"
            :disabled="!newProfileName.trim() || isCreating"
            size="small"
            class="!bg-[#e50914] !border-[#e50914]"
            @click="handleCreateProfile"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style>
/* Profile select entry animation */
.profile-select-enter {
  animation: profile-enter 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Staggered card entry */
.profile-card-stagger {
  animation: profile-card-pop 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
}

@keyframes profile-enter {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes profile-card-pop {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(16px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ── Profile Dialog Glassmorphism ── */
.profile-dialog-mask {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  background: rgba(0, 0, 0, 0.5) !important;
}

.profile-dialog-root.p-dialog {
  border: none !important;
  border-radius: 16px !important;
  overflow: hidden !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 24px 60px -12px rgba(0, 0, 0, 0.75) !important;
  animation: profile-dialog-enter 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}

.profile-dialog-header {
  background: rgba(24, 24, 27, 0.97) !important;
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
  color: white !important;
}

.profile-dialog-content {
  background: rgba(24, 24, 27, 0.97) !important;
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  color: white !important;
}

@keyframes profile-dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
