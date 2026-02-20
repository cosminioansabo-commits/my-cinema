<script setup lang="ts">
import { computed } from 'vue'
import { avatarColorOptions, getAvatarBackgroundStyle } from '@/config/avatarOptions'
import { useLanguage } from '@/composables/useLanguage'

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useLanguage()

const solidColors = computed(() => avatarColorOptions.filter((c) => c.type === 'solid'))
const gradientColors = computed(() => avatarColorOptions.filter((c) => c.type === 'gradient'))
</script>

<template>
  <div class="space-y-4">
    <!-- Solid -->
    <div>
      <span class="text-[11px] text-gray-500 uppercase tracking-wider mb-2 block font-medium">
        {{ t('profiles.solidColors') }}
      </span>
      <div class="flex gap-3 flex-wrap">
        <button
          v-for="color in solidColors"
          :key="color.value"
          class="w-10 h-10 rounded-full transition-all duration-150"
          :style="getAvatarBackgroundStyle(color.value)"
          :class="
            modelValue === color.value
              ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
              : 'hover:scale-110'
          "
          :title="t(color.labelKey)"
          @click="emit('update:modelValue', color.value)"
        />
      </div>
    </div>

    <!-- Gradients -->
    <div>
      <span class="text-[11px] text-gray-500 uppercase tracking-wider mb-2 block font-medium">
        {{ t('profiles.gradients') }}
      </span>
      <div class="flex gap-3 flex-wrap">
        <button
          v-for="color in gradientColors"
          :key="color.value"
          class="w-10 h-10 rounded-full transition-all duration-150"
          :style="getAvatarBackgroundStyle(color.value)"
          :class="
            modelValue === color.value
              ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
              : 'hover:scale-110'
          "
          :title="t(color.labelKey)"
          @click="emit('update:modelValue', color.value)"
        />
      </div>
    </div>
  </div>
</template>
