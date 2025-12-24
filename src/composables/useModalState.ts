import { computed } from 'vue'

/**
 * Composable for handling modal visibility state with v-model pattern
 *
 * @param props - Component props containing 'visible' property
 * @param emit - Component emit function with 'update:visible' event
 * @returns A computed ref that can be used with v-model:visible on Dialog/Modal components
 *
 * @example
 * ```vue
 * const props = defineProps<{ visible: boolean }>()
 * const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
 *
 * const isOpen = useModalState(props, emit)
 *
 * // In template:
 * <Dialog v-model:visible="isOpen">
 * ```
 */
export function useModalState(
  props: { visible: boolean },
  emit: (event: 'update:visible', value: boolean) => void
) {
  return computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value)
  })
}
