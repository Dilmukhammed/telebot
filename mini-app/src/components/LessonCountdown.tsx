import { useState, useEffect, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { getTashkentDiffMs } from '../utils/lessonHelpers'
import styles from './LessonCountdown.module.css'

interface LessonCountdownProps {
  date?: string
  time?: string
  inline?: boolean
}

/** Safe countdown — never produces NaN, works on iOS/Safari */
const LessonCountdown = memo(function LessonCountdown({ date, time, inline }: LessonCountdownProps) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!date || !time) return

    function calc() {
      const diff = getTashkentDiffMs(date, time)
      if (isNaN(diff)) return

      if (diff <= 0) {
        if (diff > -90 * 60 * 1000) {
          setLabel(t('dashboard.countdown.happeningNow'))
          setActive(true)
        } else {
          setLabel('')
          setActive(false)
        }
        return
      }

      setActive(false)
      const totalMin = Math.floor(diff / 60000)
      const h = Math.floor(totalMin / 60)
      const d = Math.floor(h / 24)

      if (d > 0) {
        const word = d === 1 ? t('dashboard.countdown.day') : d < 5 ? t('dashboard.countdown.daysFew') : t('dashboard.countdown.days')
        setLabel(t('dashboard.countdown.inDays', { count: d, word }))
      } else if (h > 0) {
        const remMin = totalMin % 60
        setLabel(remMin > 0 ? t('dashboard.countdown.inHoursMinutes', { h, m: remMin }) : t('dashboard.countdown.inHours', { h }))
      } else {
        setLabel(t('dashboard.countdown.inMinutes', { m: totalMin }))
      }
    }

    calc()
    const id = setInterval(calc, 30_000)
    return () => clearInterval(id)
  }, [date, time, t])

  if (!label) return null

  if (inline) {
    return (
      <span className={`${styles.countdownInline} ${active ? styles.countdownActiveInline : ''}`}>
        {active && <span className={styles.pulseDot} />}
        {label}
      </span>
    )
  }

  return (
    <span className={`${styles.countdownBadge} ${active ? styles.countdownActive : ''}`}>
      {active && <span className={styles.pulseDot} />}
      {label}
    </span>
  )
})

export default LessonCountdown
