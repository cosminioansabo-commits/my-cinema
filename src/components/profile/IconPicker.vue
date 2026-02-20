<script setup lang="ts">
import { ref, computed } from 'vue'
import { iconCategories, getIconDisplay } from '@/config/avatarOptions'
import { useLanguage } from '@/composables/useLanguage'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useLanguage()

const activeCategory = ref('popular')

const currentCategory = computed(
  () => iconCategories.find((c) => c.id === activeCategory.value) || iconCategories[0]
)
</script>

<template>
  <div class="space-y-3">
    <!-- Category tabs -->
    <div class="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
      <button
        v-for="category in iconCategories"
        :key="category.id"
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
        :class="
          activeCategory === category.id
            ? 'bg-white/15 text-white ring-1 ring-white/20'
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
        "
        @click="activeCategory = category.id"
      >
        {{ t(category.labelKey) }}
      </button>
    </div>

    <!-- Icon grid -->
    <div class="grid grid-cols-6 gap-2 min-h-[88px]">
      <button
        v-for="icon in currentCategory.icons"
        :key="icon.value"
        class="aspect-square rounded-xl flex items-center justify-center transition-all duration-150"
        :class="
          modelValue === icon.value
            ? 'bg-white/20 ring-2 ring-white/50 scale-110'
            : 'bg-white/5 hover:bg-white/10 hover:scale-110'
        "
        :title="icon.label"
        @click="emit('update:modelValue', icon.value)"
      >
        <template v-if="getIconDisplay(icon.value).type === 'pi'">
          <i :class="['pi', getIconDisplay(icon.value).content, 'text-lg text-white']" />
        </template>
        <template v-else>
          <span class="text-xl select-none">{{ getIconDisplay(icon.value).content }}</span>
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
