// ═══════════════════════════════════════════════════════════════════
// Avatar Options — centralized icon/color data for profile creation
// ═══════════════════════════════════════════════════════════════════

export interface AvatarIconOption {
  value: string // stored in DB as avatarIcon
  label: string // display label
  type: 'pi' | 'emoji'
}

export interface IconCategory {
  id: string
  labelKey: string // i18n key
  icons: AvatarIconOption[]
}

export interface AvatarColorOption {
  value: string // stored in DB — hex or gradient CSS
  labelKey: string
  type: 'solid' | 'gradient'
}

// ── Emoji Map ──────────────────────────────────────────────────────

export const emojiMap: Record<string, string> = {
  // Animals
  'emoji-wolf': '\u{1F43A}',
  'emoji-cat': '\u{1F431}',
  'emoji-dog': '\u{1F436}',
  'emoji-fox': '\u{1F98A}',
  'emoji-bear': '\u{1F43B}',
  'emoji-unicorn': '\u{1F984}',
  'emoji-owl': '\u{1F989}',
  'emoji-butterfly': '\u{1F98B}',
  'emoji-dolphin': '\u{1F42C}',
  'emoji-panda': '\u{1F43C}',
  // Space
  'emoji-rocket': '\u{1F680}',
  'emoji-alien': '\u{1F47D}',
  'emoji-star2': '\u{1F31F}',
  'emoji-moon': '\u{1F319}',
  'emoji-comet': '\u{2604}\u{FE0F}',
  'emoji-saturn': '\u{1FA90}',
  // Entertainment
  'emoji-popcorn': '\u{1F37F}',
  'emoji-clapper': '\u{1F3AC}',
  'emoji-guitar': '\u{1F3B8}',
  'emoji-gamepad': '\u{1F3AE}',
  'emoji-headphones': '\u{1F3A7}',
  'emoji-ticket': '\u{1F3AB}',
  // Sports
  'emoji-soccer': '\u{26BD}',
  'emoji-basketball': '\u{1F3C0}',
  'emoji-tennis': '\u{1F3BE}',
  'emoji-mountain': '\u{26F0}\u{FE0F}',
  'emoji-surfing': '\u{1F3C4}',
  'emoji-bike': '\u{1F6B4}',
  // Food
  'emoji-pizza': '\u{1F355}',
  'emoji-taco': '\u{1F32E}',
  'emoji-icecream': '\u{1F366}',
  'emoji-coffee': '\u{2615}',
  'emoji-donut': '\u{1F369}',
  'emoji-avocado': '\u{1F951}',
  // Symbols
  'emoji-fire': '\u{1F525}',
  'emoji-sparkles': '\u{2728}',
  'emoji-rainbow': '\u{1F308}',
  'emoji-diamond': '\u{1F48E}',
  'emoji-infinity': '\u{267E}\u{FE0F}',
  'emoji-ghost': '\u{1F47B}',
}

// ── Icon Categories ────────────────────────────────────────────────

export const iconCategories: IconCategory[] = [
  {
    id: 'popular',
    labelKey: 'profiles.iconCategories.popular',
    icons: [
      { value: 'pi-user', label: 'Person', type: 'pi' },
      { value: 'pi-star', label: 'Star', type: 'pi' },
      { value: 'pi-heart', label: 'Heart', type: 'pi' },
      { value: 'pi-bolt', label: 'Lightning', type: 'pi' },
      { value: 'pi-crown', label: 'Crown', type: 'pi' },
      { value: 'pi-sun', label: 'Sun', type: 'pi' },
      { value: 'pi-moon', label: 'Moon', type: 'pi' },
      { value: 'pi-flag', label: 'Flag', type: 'pi' },
    ],
  },
  {
    id: 'animals',
    labelKey: 'profiles.iconCategories.animals',
    icons: [
      { value: 'emoji-wolf', label: 'Wolf', type: 'emoji' },
      { value: 'emoji-cat', label: 'Cat', type: 'emoji' },
      { value: 'emoji-dog', label: 'Dog', type: 'emoji' },
      { value: 'emoji-fox', label: 'Fox', type: 'emoji' },
      { value: 'emoji-bear', label: 'Bear', type: 'emoji' },
      { value: 'emoji-unicorn', label: 'Unicorn', type: 'emoji' },
      { value: 'emoji-owl', label: 'Owl', type: 'emoji' },
      { value: 'emoji-butterfly', label: 'Butterfly', type: 'emoji' },
      { value: 'emoji-dolphin', label: 'Dolphin', type: 'emoji' },
      { value: 'emoji-panda', label: 'Panda', type: 'emoji' },
    ],
  },
  {
    id: 'space',
    labelKey: 'profiles.iconCategories.space',
    icons: [
      { value: 'emoji-rocket', label: 'Rocket', type: 'emoji' },
      { value: 'emoji-alien', label: 'Alien', type: 'emoji' },
      { value: 'emoji-star2', label: 'Glowing Star', type: 'emoji' },
      { value: 'emoji-moon', label: 'Moon', type: 'emoji' },
      { value: 'emoji-comet', label: 'Comet', type: 'emoji' },
      { value: 'emoji-saturn', label: 'Saturn', type: 'emoji' },
    ],
  },
  {
    id: 'entertainment',
    labelKey: 'profiles.iconCategories.entertainment',
    icons: [
      { value: 'emoji-popcorn', label: 'Popcorn', type: 'emoji' },
      { value: 'emoji-clapper', label: 'Clapper Board', type: 'emoji' },
      { value: 'emoji-guitar', label: 'Guitar', type: 'emoji' },
      { value: 'emoji-gamepad', label: 'Game Controller', type: 'emoji' },
      { value: 'emoji-headphones', label: 'Headphones', type: 'emoji' },
      { value: 'emoji-ticket', label: 'Ticket', type: 'emoji' },
    ],
  },
  {
    id: 'sports',
    labelKey: 'profiles.iconCategories.sports',
    icons: [
      { value: 'emoji-soccer', label: 'Soccer', type: 'emoji' },
      { value: 'emoji-basketball', label: 'Basketball', type: 'emoji' },
      { value: 'emoji-tennis', label: 'Tennis', type: 'emoji' },
      { value: 'emoji-mountain', label: 'Mountain', type: 'emoji' },
      { value: 'emoji-surfing', label: 'Surfing', type: 'emoji' },
      { value: 'emoji-bike', label: 'Bicycle', type: 'emoji' },
    ],
  },
  {
    id: 'food',
    labelKey: 'profiles.iconCategories.food',
    icons: [
      { value: 'emoji-pizza', label: 'Pizza', type: 'emoji' },
      { value: 'emoji-taco', label: 'Taco', type: 'emoji' },
      { value: 'emoji-icecream', label: 'Ice Cream', type: 'emoji' },
      { value: 'emoji-coffee', label: 'Coffee', type: 'emoji' },
      { value: 'emoji-donut', label: 'Donut', type: 'emoji' },
      { value: 'emoji-avocado', label: 'Avocado', type: 'emoji' },
    ],
  },
  {
    id: 'symbols',
    labelKey: 'profiles.iconCategories.symbols',
    icons: [
      { value: 'pi-shield', label: 'Shield', type: 'pi' },
      { value: 'emoji-fire', label: 'Fire', type: 'emoji' },
      { value: 'emoji-sparkles', label: 'Sparkles', type: 'emoji' },
      { value: 'emoji-rainbow', label: 'Rainbow', type: 'emoji' },
      { value: 'emoji-diamond', label: 'Diamond', type: 'emoji' },
      { value: 'emoji-infinity', label: 'Infinity', type: 'emoji' },
      { value: 'emoji-ghost', label: 'Ghost', type: 'emoji' },
    ],
  },
]

// ── Color Options ──────────────────────────────────────────────────

export const avatarColorOptions: AvatarColorOption[] = [
  // Solid
  { value: '#e50914', labelKey: 'profiles.colors.red', type: 'solid' },
  { value: '#e87c03', labelKey: 'profiles.colors.orange', type: 'solid' },
  { value: '#e5b100', labelKey: 'profiles.colors.gold', type: 'solid' },
  { value: '#2cb67d', labelKey: 'profiles.colors.green', type: 'solid' },
  { value: '#0ea5e9', labelKey: 'profiles.colors.blue', type: 'solid' },
  { value: '#7c3aed', labelKey: 'profiles.colors.purple', type: 'solid' },
  { value: '#db2777', labelKey: 'profiles.colors.pink', type: 'solid' },
  { value: '#6366f1', labelKey: 'profiles.colors.indigo', type: 'solid' },
  // Gradients
  { value: 'linear-gradient(135deg, #e50914, #ff6b35)', labelKey: 'profiles.colors.sunset', type: 'gradient' },
  { value: 'linear-gradient(135deg, #7c3aed, #db2777)', labelKey: 'profiles.colors.neon', type: 'gradient' },
  { value: 'linear-gradient(135deg, #0ea5e9, #2cb67d)', labelKey: 'profiles.colors.ocean', type: 'gradient' },
  { value: 'linear-gradient(135deg, #6366f1, #8b5cf6)', labelKey: 'profiles.colors.cosmic', type: 'gradient' },
  { value: 'linear-gradient(135deg, #f59e0b, #ef4444)', labelKey: 'profiles.colors.flame', type: 'gradient' },
  { value: 'linear-gradient(135deg, #ec4899, #8b5cf6)', labelKey: 'profiles.colors.aurora', type: 'gradient' },
  { value: 'linear-gradient(135deg, #14b8a6, #3b82f6)', labelKey: 'profiles.colors.lagoon', type: 'gradient' },
  { value: 'linear-gradient(135deg, #f43f5e, #fb923c)', labelKey: 'profiles.colors.coral', type: 'gradient' },
]

// ── Helpers ─────────────────────────────────────────────────────────

export function isGradient(colorValue: string): boolean {
  return colorValue.startsWith('linear-gradient')
}

export function getAvatarBackgroundStyle(colorValue: string): Record<string, string> {
  if (isGradient(colorValue)) {
    return { background: colorValue }
  }
  return { backgroundColor: colorValue }
}

/** Extracts the first hex color for glow/shadow effects */
export function getPrimaryColor(colorValue: string): string {
  if (isGradient(colorValue)) {
    const match = colorValue.match(/#[0-9a-fA-F]{6}/)
    return match ? match[0] : '#e50914'
  }
  return colorValue
}

export function isEmojiIcon(iconValue: string): boolean {
  return iconValue.startsWith('emoji-')
}

export function getIconDisplay(iconValue: string): { type: 'pi' | 'emoji'; content: string } {
  if (isEmojiIcon(iconValue)) {
    return { type: 'emoji', content: emojiMap[iconValue] || '?' }
  }
  return { type: 'pi', content: iconValue }
}
