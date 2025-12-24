import { ref } from 'vue'

export interface SubtitleStyle {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  fontColor: string
  backgroundColor: string
  backgroundOpacity: number
}

const STORAGE_KEY = 'my-cinema-subtitle-style'

const defaultSubtitleStyle: SubtitleStyle = {
  fontSize: 'medium',
  fontColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.75
}

export const fontSizeOptions = [
  { label: 'Small', value: 'small' as const },
  { label: 'Medium', value: 'medium' as const },
  { label: 'Large', value: 'large' as const },
  { label: 'X-Large', value: 'xlarge' as const }
]

export const fontColorOptions = [
  { label: 'White', value: '#ffffff' },
  { label: 'Yellow', value: '#ffff00' },
  { label: 'Green', value: '#00ff00' },
  { label: 'Cyan', value: '#00ffff' }
]

export const bgOpacityOptions = [
  { label: 'None', value: 0 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 }
]

const fontSizes: Record<string, string> = {
  small: '16px',
  medium: '22px',
  large: '28px',
  xlarge: '36px'
}

function loadSubtitleStyle(): SubtitleStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {
    console.error('Failed to load subtitle style:', e)
  }
  return defaultSubtitleStyle
}

export function useSubtitleStyle() {
  const subtitleStyle = ref<SubtitleStyle>(loadSubtitleStyle())

  const saveSubtitleStyle = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subtitleStyle.value))
    applySubtitleStyle()
  }

  const applySubtitleStyle = () => {
    let styleEl = document.getElementById('subtitle-style')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'subtitle-style'
      document.head.appendChild(styleEl)
    }

    const bgColor = subtitleStyle.value.backgroundColor
    const bgOpacity = subtitleStyle.value.backgroundOpacity
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)

    styleEl.textContent = `
      video::cue {
        font-size: ${fontSizes[subtitleStyle.value.fontSize]};
        color: ${subtitleStyle.value.fontColor};
        background-color: rgba(${r}, ${g}, ${b}, ${bgOpacity});
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    `
  }

  const updateFontSize = (value: SubtitleStyle['fontSize']) => {
    subtitleStyle.value.fontSize = value
    saveSubtitleStyle()
  }

  const updateFontColor = (value: string) => {
    subtitleStyle.value.fontColor = value
    saveSubtitleStyle()
  }

  const updateBackgroundOpacity = (value: number) => {
    subtitleStyle.value.backgroundOpacity = value
    saveSubtitleStyle()
  }

  return {
    subtitleStyle,
    saveSubtitleStyle,
    applySubtitleStyle,
    updateFontSize,
    updateFontColor,
    updateBackgroundOpacity,
    fontSizeOptions,
    fontColorOptions,
    bgOpacityOptions
  }
}
