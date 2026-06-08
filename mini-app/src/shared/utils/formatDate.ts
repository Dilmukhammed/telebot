/**
 * Format a date string using the given locale.
 * Falls back to 'ru-RU' if locale is not provided.
 */
export function formatDateTime(iso: string, locale: string = 'ru-RU'): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Format a date-only string (no time).
 */
export function formatDate(iso: string, locale: string = 'ru-RU'): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Map i18n language code to locale string for toLocaleDateString.
 */
export function langToLocale(lang: string): string {
  switch (lang) {
    case 'en': return 'en-US'
    case 'uz': return 'uz-UZ'
    case 'ru': return 'ru-RU'
    default: return 'ru-RU'
  }
}
