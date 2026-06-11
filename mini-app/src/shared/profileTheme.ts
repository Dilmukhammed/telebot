import type { CSSProperties } from 'react'
import type { ProfileThemeOut } from './types'

export const PROFILE_CARD_THEME_IDS = [
  'default',
  'lavender',
  'mint',
  'dusk',
  'slate',
  'rose',
  'ocean',
] as const

export type ProfileCardThemeId = (typeof PROFILE_CARD_THEME_IDS)[number]

export const PROFILE_STATUS_EMOJIS = ['📚', '✏️', '🎯', '💪', '☕', '🎧', '🌙', '✨', '📐', '🧪', '🎨', '🚀'] as const

type ThemePreset = {
  swatch: string
  card: CSSProperties
  ring: string
}

export const PROFILE_CARD_PRESETS: Record<ProfileCardThemeId, ThemePreset> = {
  default: {
    swatch: 'linear-gradient(135deg, #f5f3f8 0%, #ffffff 100%)',
    card: {
      background: 'var(--color-surface-container-lowest)',
      border: '1px solid var(--color-gray-200)',
    },
    ring: 'var(--color-primary, #630ed4)',
  },
  lavender: {
    swatch: 'linear-gradient(135deg, #e8dcff 0%, #f6f0ff 100%)',
    card: {
      background: 'linear-gradient(165deg, #efe6ff 0%, #faf7ff 55%, #ffffff 100%)',
      border: '1px solid rgba(99, 14, 212, 0.12)',
    },
    ring: '#7c3aed',
  },
  mint: {
    swatch: 'linear-gradient(135deg, #c8f0e4 0%, #e8faf4 100%)',
    card: {
      background: 'linear-gradient(165deg, #dff7ee 0%, #f2fcf8 55%, #ffffff 100%)',
      border: '1px solid rgba(16, 185, 129, 0.14)',
    },
    ring: '#059669',
  },
  dusk: {
    swatch: 'linear-gradient(135deg, #ffd9c8 0%, #fff0e8 100%)',
    card: {
      background: 'linear-gradient(165deg, #ffe8dc 0%, #fff6f0 55%, #ffffff 100%)',
      border: '1px solid rgba(234, 88, 12, 0.12)',
    },
    ring: '#ea580c',
  },
  slate: {
    swatch: 'linear-gradient(135deg, #d8e0ea 0%, #eef2f7 100%)',
    card: {
      background: 'linear-gradient(165deg, #e8edf4 0%, #f4f7fa 55%, #ffffff 100%)',
      border: '1px solid rgba(71, 85, 105, 0.12)',
    },
    ring: '#475569',
  },
  rose: {
    swatch: 'linear-gradient(135deg, #ffd6e8 0%, #fff0f6 100%)',
    card: {
      background: 'linear-gradient(165deg, #ffe4ef 0%, #fff5f9 55%, #ffffff 100%)',
      border: '1px solid rgba(219, 39, 119, 0.1)',
    },
    ring: '#db2777',
  },
  ocean: {
    swatch: 'linear-gradient(135deg, #c8e4ff 0%, #e8f4ff 100%)',
    card: {
      background: 'linear-gradient(165deg, #dcebff 0%, #f0f8ff 55%, #ffffff 100%)',
      border: '1px solid rgba(37, 99, 235, 0.12)',
    },
    ring: '#2563eb',
  },
}

export function normalizeProfileTheme(theme?: ProfileThemeOut | null): ProfileThemeOut {
  const requested = theme?.card_theme || 'default'
  const cardTheme: ProfileCardThemeId = PROFILE_CARD_THEME_IDS.includes(requested as ProfileCardThemeId)
    ? (requested as ProfileCardThemeId)
    : 'default'
  return {
    card_theme: cardTheme,
    status_emoji: theme?.status_emoji || undefined,
    status_text: theme?.status_text || undefined,
  }
}

export function getProfileCardStyle(theme?: ProfileThemeOut | null): CSSProperties & { '--profile-ring'?: string } {
  const normalized = normalizeProfileTheme(theme)
  const preset = PROFILE_CARD_PRESETS[normalized.card_theme as ProfileCardThemeId] || PROFILE_CARD_PRESETS.default
  return {
    ...preset.card,
    '--profile-ring': preset.ring,
  }
}

export function hasProfileStatus(theme?: ProfileThemeOut | null): boolean {
  const t = normalizeProfileTheme(theme)
  return Boolean(t.status_emoji || t.status_text)
}
