<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore, type Profile } from '@/stores/profileStore'
import { useAuthStore } from '@/stores/authStore'
import { useLanguage } from '@/composables/useLanguage'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()
const { t } = useLanguage()

const isManaging = ref(false)
const showCreateDialog = ref(false)
const newProfileName = ref('')
const selectedColor = ref('#e50914')
const selectedIcon = ref('pi-user')
const isCreating = ref(false)

const avatarColors = [
  '#e50914', '#e87c03', '#e5b100', '#2cb67d',
  '#0ea5e9', '#7c3aed', '#db2777', '#6366f1'
]

const avatarIcons = [
  'pi-user', 'pi-star', 'pi-heart', 'pi-bolt',
  'pi-sun', 'pi-moon', 'pi-crown', 'pi-flag'
]

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
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-[#141414] p-6">
    <div class="fixed inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#141414] to-[#0f0f0f] -z-10"></div>

    <div class="w-full max-w-3xl">
      <!-- Logo -->
      <div class="text-center mb-10">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#e50914] to-[#b20710] flex items-center justify-center shadow-lg shadow-[#e50914]/20">
          <i class="pi pi-play text-3xl text-white"></i>
        </div>
        <h1 class="text-3xl font-bold text-white mb-2">{{ t('profiles.whoIsWatching') }}</h1>
      </div>

      <!-- Loading -->
      <div v-if="profileStore.isLoading" class="flex justify-center py-12">
        <i class="pi pi-spin pi-spinner text-4xl text-gray-400"></i>
      </div>

      <!-- Profile Grid -->
      <div v-else class="flex flex-wrap justify-center gap-6 mb-8">
        <!-- Existing Profiles -->
        <button
          v-for="profile in profileStore.profiles"
          :key="profile.id"
          class="group flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:bg-white/5"
          :class="{ 'ring-2 ring-white/30': isManaging }"
          @click="isManaging ? handleManageProfile(profile) : handleSelectProfile(profile)"
        >
          <div
            class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 relative"
            :style="{ backgroundColor: profile.avatarColor }"
          >
            <i :class="['pi', profile.avatarIcon, 'text-4xl sm:text-5xl text-white']"></i>
            <!-- Edit overlay when managing -->
            <div
              v-if="isManaging"
              class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center"
            >
              <i class="pi pi-pencil text-2xl text-white"></i>
            </div>
          </div>
          <span class="text-gray-300 text-sm sm:text-base group-hover:text-white transition-colors">
            {{ profile.name }}
          </span>
        </button>

        <!-- Add Profile Button -->
        <button
          v-if="profileStore.profileCount < 8"
          class="group flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:bg-white/5"
          @click="openCreateDialog"
        >
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-600 group-hover:border-gray-400 transition-colors">
            <i class="pi pi-plus text-4xl text-gray-600 group-hover:text-gray-400 transition-colors"></i>
          </div>
          <span class="text-gray-500 text-sm sm:text-base group-hover:text-gray-300 transition-colors">
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
      :style="{ width: '28rem' }"
      :pt="{ root: { class: '!bg-zinc-900 !border-zinc-700' }, header: { class: '!bg-zinc-900 !text-white !border-b !border-zinc-700' }, content: { class: '!bg-zinc-900 !text-white' } }"
    >
      <div class="space-y-6 pt-2">
        <!-- Preview -->
        <div class="flex justify-center">
          <div
            class="w-20 h-20 rounded-xl flex items-center justify-center transition-all"
            :style="{ backgroundColor: selectedColor }"
          >
            <i :class="['pi', selectedIcon, 'text-3xl text-white']"></i>
          </div>
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

        <!-- Color -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.color') }}</label>
          <div class="flex gap-3 flex-wrap">
            <button
              v-for="color in avatarColors"
              :key="color"
              class="w-10 h-10 rounded-full transition-all duration-150"
              :style="{ backgroundColor: color }"
              :class="selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-110'"
              @click="selectedColor = color"
            />
          </div>
        </div>

        <!-- Icon -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.icon') }}</label>
          <div class="flex gap-3 flex-wrap">
            <button
              v-for="icon in avatarIcons"
              :key="icon"
              class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-150"
              :class="selectedIcon === icon ? 'bg-white/20 ring-2 ring-white/50 scale-110' : 'bg-white/5 hover:bg-white/10 hover:scale-110'"
              @click="selectedIcon = icon"
            >
              <i :class="['pi', icon, 'text-lg text-white']"></i>
            </button>
          </div>
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
