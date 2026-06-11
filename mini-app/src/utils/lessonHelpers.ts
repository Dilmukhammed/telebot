import { TASHKENT_OFFSET_MS } from './constants'

/**
 * Calculates the time difference in milliseconds between now and a lesson
 * scheduled at the given date/time in Tashkent timezone.
 * Returns NaN if inputs are invalid.
 */
export const getTashkentDiffMs = (dateStr?: string, timeStr?: string): number => {
  if (!dateStr || !timeStr) return NaN
  try {
    const dp = dateStr.split('-').map(Number)   // [YYYY, MM, DD]
    const tp = timeStr.split(':').map(Number)   // [HH, MM]
    if (dp.length < 3 || tp.length < 2) return NaN
    if (dp.some(isNaN) || tp.some(isNaN)) return NaN

    const utcMs = Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0)
    return utcMs - TASHKENT_OFFSET_MS - Date.now()
  } catch {
    return NaN
  }
}

/** Returns true if the lesson starts within the next hour */
export const isLessThanAnHourAway = (dateStr?: string, timeStr?: string): boolean => {
  const diff = getTashkentDiffMs(dateStr, timeStr)
  return !isNaN(diff) && diff > 0 && diff < 60 * 60 * 1000
}

/** Returns true if the lesson is currently in progress (started and within 90 minutes) */
export const isLessonOngoing = (dateStr?: string, timeStr?: string): boolean => {
  const diff = getTashkentDiffMs(dateStr, timeStr)
  return !isNaN(diff) && diff <= 0 && diff > -90 * 60 * 1000
}

/**
 * Returns a greeting string based on the current time of day in Tashkent.
 * Optionally accepts a translation function for i18n support.
 */
export const getGreeting = (firstName: string, t?: (key: string, opts?: Record<string, unknown>) => string): string => {
  const utcHour = new Date().getUTCHours()
  const tashkentHour = (utcHour + 5) % 24
  if (tashkentHour >= 5 && tashkentHour < 12) {
    return t ? t('dashboard.greetingMorning', { name: firstName, defaultValue: `Доброе утро, ${firstName}! ☀️` }) : `Доброе утро, ${firstName}! ☀️`
  }
  if (tashkentHour >= 12 && tashkentHour < 18) {
    return t ? t('dashboard.greetingAfternoon', { name: firstName, defaultValue: `Добрый день, ${firstName}! 🌤️` }) : `Добрый день, ${firstName}! 🌤️`
  }
  if (tashkentHour >= 18 && tashkentHour < 22) {
    return t ? t('dashboard.greetingEvening', { name: firstName, defaultValue: `Добрый вечер, ${firstName}! 🌙` }) : `Добрый вечер, ${firstName}! 🌙`
  }
  return t ? t('dashboard.greetingNight', { name: firstName, defaultValue: `Доброй ночи, ${firstName}! 🌌` }) : `Доброй ночи, ${firstName}! 🌌`
}

/**
 * Returns a status string describing how many lessons are scheduled today.
 * Uses Russian pluralization rules.
 * Optionally accepts a translation function for i18n support.
 */
export const getTodayLessonsStatus = (
  lessons: { date: string }[],
  t?: (key: string, opts?: Record<string, unknown>) => string
): string => {
  const tashkentDate = new Date(Date.now() + TASHKENT_OFFSET_MS)
  const yyyy = tashkentDate.getUTCFullYear()
  const mm = String(tashkentDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(tashkentDate.getUTCDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`

  const count = lessons.filter(l => l.date === todayStr).length
  if (count === 0) {
    return t ? (t('dashboard.motivation') || 'Сегодня занятий нет. Отличный день для подготовки! ✨') : 'Сегодня занятий нет. Отличный день для подготовки! ✨'
  }

  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `Сегодня у вас ${count} запланированное занятие`
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `Сегодня у вас ${count} запланированных занятия`
  }
  return `Сегодня у вас ${count} запланированных занятий`
}
