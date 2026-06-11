import { memo } from 'react'
import {
  MONTH_NAMES_RU, MONTH_NAMES_EN, MONTH_NAMES_UZ,
  DAY_NAMES_SHORT_RU, DAY_NAMES_SHORT_EN, DAY_NAMES_SHORT_UZ,
  TASHKENT_OFFSET_MS,
} from '../utils/constants'
import styles from './MiniCalendar.module.css'

/** Month name arrays indexed by language prefix */
const MONTH_NAMES: Record<string, readonly string[]> = {
  en: MONTH_NAMES_EN,
  uz: MONTH_NAMES_UZ,
  ru: MONTH_NAMES_RU,
}

/** Day name arrays indexed by language prefix */
const DAY_NAMES: Record<string, readonly string[]> = {
  en: DAY_NAMES_SHORT_EN,
  uz: DAY_NAMES_SHORT_UZ,
  ru: DAY_NAMES_SHORT_RU,
}

interface MiniCalendarProps {
  /** Current language code (e.g. 'en', 'uz', 'ru') */
  language?: string
}

/** Small calendar widget showing today's date in Tashkent timezone */
const MiniCalendar = memo(function MiniCalendar({ language = 'ru' }: MiniCalendarProps) {
  const today = new Date(Date.now() + TASHKENT_OFFSET_MS)
  const dayNum = today.getUTCDate()

  const langKey = language?.startsWith('en') ? 'en' : language?.startsWith('uz') ? 'uz' : 'ru'
  const monthNames = MONTH_NAMES[langKey] || MONTH_NAMES_RU
  const dayNames = DAY_NAMES[langKey] || DAY_NAMES_SHORT_RU

  const monthLabel = monthNames[today.getUTCMonth()] || ''
  const dayLabel = dayNames[today.getUTCDay()] || ''

  return (
    <div className={styles.calendarWidget}>
      <div className={styles.calendarHeader}>
        {monthLabel}
      </div>
      <div className={styles.calendarBody}>
        <span className={styles.calendarDayNum}>{dayNum}</span>
        <span className={styles.calendarDayName}>{dayLabel}</span>
      </div>
    </div>
  )
})

export default MiniCalendar
