<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profileStore'
import { useLanguage } from '@/composables/useLanguage'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()
const { t } = useLanguage()

const profileId = computed(() => route.params.id as string)
const name = ref('')
const avatarColor = ref('#e50914')
const avatarIcon = ref('pi-user')
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const uniqueMedia = ref<{ movies: number; shows: number } | null>(null)

const avatarColors = [
  '#e50914', '#e87c03', '#e5b100', '#2cb67d',
  '#0ea5e9', '#7c3aed', '#db2777', '#6366f1'
]

const avatarIcons = [
  'pi-user', 'pi-star', 'pi-heart', 'pi-bolt',
  'pi-sun', 'pi-moon', 'pi-crown', 'pi-flag'
]

const profile = computed(() => profileStore.profiles.find(p => p.id === profileId.value))

const hasChanges = computed(() => {
  if (!profile.value) return false
  return (
    name.value !== profile.value.name ||
    avatarColor.value !== profile.value.avatarColor ||
    avatarIcon.value !== profile.value.avatarIcon
  )
})

onMounted(async () => {
  if (profileStore.profiles.length === 0) {
    await profileStore.fetchProfiles()
  }
  if (profile.value) {
    name.value = profile.value.name
    avatarColor.value = profile.value.avatarColor
    avatarIcon.value = profile.value.avatarIcon
  }
})

async function handleSave() {
  if (!hasChanges.value || !name.value.trim()) return
  isSaving.value = true
  const result = await profileStore.updateProfile(profileId.value, {
    name: name.value.trim(),
    avatarColor: avatarColor.value,
    avatarIcon: avatarIcon.value
  })
  isSaving.value = false
  if (result) {
    router.push({ name: 'profiles' })
  }
}

async function openDeleteDialog() {
  uniqueMedia.value = await profileStore.getUniqueMediaCount(profileId.value)
  showDeleteDialog.value = true
}

async function handleDelete() {
  isDeleting.value = true
  const success = await profileStore.deleteProfile(profileId.value)
  isDeleting.value = false
  if (success) {
    showDeleteDialog.value = false
    router.push({ name: 'profiles' })
  }
}

function goBack() {
  router.push({ name: 'profiles' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-[#141414] p-6">
    <div class="fixed inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#141414] to-[#0f0f0f] -z-10"></div>

    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-white mb-2">{{ t('profiles.editProfile') }}</h1>
      </div>

      <div v-if="!profile" class="text-center py-12">
        <i class="pi pi-spin pi-spinner text-4xl text-gray-400"></i>
      </div>

      <div v-else class="bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 p-8 space-y-6">
        <!-- Preview -->
        <div class="flex justify-center">
          <div
            class="w-24 h-24 rounded-xl flex items-center justify-center transition-all"
            :style="{ backgroundColor: avatarColor }"
          >
            <i :class="['pi', avatarIcon, 'text-4xl text-white']"></i>
          </div>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">{{ t('profiles.name') }}</label>
          <InputText
            v-model="name"
            :placeholder="t('profiles.namePlaceholder')"
            class="w-full !bg-zinc-800 !border-zinc-700 !text-white focus:!border-[#e50914] !rounded-lg"
            maxlength="30"
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
              :class="avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-110'"
              @click="avatarColor = color"
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
              :class="avatarIcon === icon ? 'bg-white/20 ring-2 ring-white/50 scale-110' : 'bg-white/5 hover:bg-white/10 hover:scale-110'"
              @click="avatarIcon = icon"
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
        <div class="flex justify-between pt-2">
          <Button
            v-if="!profile.isDefault"
            :label="t('profiles.deleteProfile')"
            severity="danger"
            text
            size="small"
            icon="pi pi-trash"
            @click="openDeleteDialog"
          />
          <div v-else></div>

          <div class="flex gap-3">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              outlined
              size="small"
              @click="goBack"
            />
            <Button
              :label="t('common.save')"
              :loading="isSaving"
              :disabled="!hasChanges || !name.trim() || isSaving"
              size="small"
              class="!bg-[#e50914] !border-[#e50914]"
              @click="handleSave"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog
      v-model:visible="showDeleteDialog"
      :header="t('profiles.deleteProfile')"
      modal
      :style="{ width: '26rem' }"
      :pt="{ root: { class: '!bg-zinc-900 !border-zinc-700' }, header: { class: '!bg-zinc-900 !text-white !border-b !border-zinc-700' }, content: { class: '!bg-zinc-900 !text-white' } }"
    >
      <div class="space-y-4 pt-2">
        <p class="text-gray-300">
          {{ t('profiles.deleteConfirm', { name: profile?.name }) }}
        </p>

        <!-- Unique media warning -->
        <div
          v-if="uniqueMedia && (uniqueMedia.movies > 0 || uniqueMedia.shows > 0)"
          class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3"
        >
          <p class="text-amber-400 text-sm flex items-start gap-2">
            <i class="pi pi-exclamation-triangle mt-0.5"></i>
            <span>
              {{ t('profiles.deleteWarning', {
                movies: uniqueMedia.movies,
                shows: uniqueMedia.shows
              }) }}
            </span>
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button
            :label="t('common.cancel')"
            severity="secondary"
            outlined
            size="small"
            @click="showDeleteDialog = false"
          />
          <Button
            :label="t('profiles.deleteProfile')"
            severity="danger"
            size="small"
            :loading="isDeleting"
            icon="pi pi-trash"
            @click="handleDelete"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>
