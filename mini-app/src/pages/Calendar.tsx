import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getCalendar, createAvailability, deleteAvailability } from '../api/client'
import { useUser } from '../context/UserContext'
import type { CalendarWeekOut, CalendarLessonOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Calendar.module.css'

const DAY_NAMES = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  uz: ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Ya'],
}

const MONTH_NAMES = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const getTashkentDate = () => {
  const d = new Date()
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
  return new Date(utc + (3600000 * 5)) // Tashkent (UTC+5)
}

const getLocalDateString = (d: Date = getTashkentDate()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Calendar() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<CalendarWeekOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<'day' | 'week'>(() => searchParams.get('view') === 'week' ? 'week' : 'day')
  const [selectedDay, setSelectedDay] = useState(0)
  const [now, setNow] = useState(getTashkentDate())
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(getTashkentDate().getFullYear())
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; startTime: string; endTime: string; dayOfWeek: number; isNew: boolean; slotId?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user } = useUser()
  const userRole = user?.role ?? null

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getTashkentDate())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeTop = (currentHour * 80) + (currentMinute / 60 * 80)

  const jumpToMonth = (year: number, month: number) => {
    // Calculate week offset to jump to the first Monday of the given month
    const today = getTashkentDate()
    const currentMonday = new Date(today)
    currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

    // First day of target month
    const firstDay = new Date(year, month, 1)
    // Find the Monday of that week
    const targetMonday = new Date(firstDay)
    targetMonday.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))

    const diffMs = targetMonday.getTime() - currentMonday.getTime()
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
    setSelectedDay(0)
    setShowMonthPicker(false)
  }


  const lang = i18n.language as 'ru' | 'en' | 'uz'
  const dayNames = DAY_NAMES[lang] || DAY_NAMES.ru
  const monthNames = MONTH_NAMES[lang] || MONTH_NAMES.ru

  useEffect(() => {
    setLoading(true)
    setError(null)
    getCalendar(weekOffset)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error loading calendar'))
      .finally(() => setLoading(false))
  }, [weekOffset])

  useEffect(() => {
    if (data) {
      const today = getLocalDateString()
      const todayIndex = data.days.findIndex(d => d.date === today)
      if (todayIndex >= 0) setSelectedDay(todayIndex)
    }
  }, [data])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('calendar.title')} hideProfile />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>error</span>
          <p style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{error || t('common.error')}</p>
          <button
            onClick={() => { setWeekOffset(0) }}
            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const currentDay = data.days[selectedDay]
  const monday = data.days[0]?.date
  const monthName = monday ? monthNames[new Date(monday + 'T00:00:00').getMonth()] : ''
  const year = monday ? new Date(monday + 'T00:00:00').getFullYear() : ''

  return (
    <div className={styles.page}>
      <SiteHeader title={t('calendar.title')} hideProfile />

      {/* Calendar Navigation */}
      <div className={styles.calendarNav}>
        <div className={styles.headerLeft}>
          <button className={styles.monthTitleButton} onClick={() => { setPickerYear(Number(year)); setShowMonthPicker(!showMonthPicker) }}>
            <h2 className={styles.headerTitle}>{monthName} {year}</h2>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
          </button>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.navButtons}>
            <button className={styles.navButton} onClick={() => setWeekOffset(w => w - 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
            </button>
            <button
              className={styles.todayButton}
              onClick={() => {
                setWeekOffset(0)
                const jsDay = getTashkentDate().getDay()
                const ourDay = (jsDay + 6) % 7
                setSelectedDay(ourDay)
              }}
            >
              {t('calendar.today')}
            </button>
            <button className={styles.navButton} onClick={() => setWeekOffset(w => w + 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Month Picker */}
      {showMonthPicker && (
        <div className={styles.monthPickerOverlay} onClick={() => setShowMonthPicker(false)}>
          <div className={styles.monthPicker} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerYearNav}>
              <button className={styles.navButton} onClick={() => setPickerYear(y => y - 1)}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
              </button>
              <span className={styles.pickerYear}>{pickerYear}</span>
              <button className={styles.navButton} onClick={() => setPickerYear(y => y + 1)}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
              </button>
            </div>
            <div className={styles.monthGrid}>
              {monthNames.map((name, i) => (
                <button
                  key={i}
                  className={`${styles.monthButton} ${Number(year) === pickerYear && new Date(monday + 'T00:00:00').getMonth() === i ? styles.monthButtonActive : ''}`}
                  onClick={() => jumpToMonth(pickerYear, i)}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.viewButton} ${view === 'day' ? styles.viewButtonActive : ''}`}
          onClick={() => { setView('day'); setSearchParams(prev => { prev.set('view', 'day'); return prev }, { replace: true }) }}
        >
          {t('calendar.dayView')}
        </button>
        <button
          className={`${styles.viewButton} ${view === 'week' ? styles.viewButtonActive : ''}`}
          onClick={() => { setView('week'); setSearchParams(prev => { prev.set('view', 'week'); return prev }, { replace: true }) }}
        >
          {t('calendar.weekView')}
        </button>
      </div>

      {/* Day View */}
      {view === 'day' && (
        <>
          {/* Week Strip */}
          <div className={styles.weekStrip}>
            {data.days.map((day, i) => (
              <button
                key={day.date}
                className={`${styles.dayButton} ${i === selectedDay ? styles.dayButtonActive : ''}`}
                onClick={() => setSelectedDay(i)}
              >
                <span className={styles.dayName}>{dayNames[i]}</span>
                <span className={styles.dayNumber}>{new Date(day.date + 'T00:00:00').getDate()}</span>
              </button>
            ))}
          </div>

          {/* Day Lessons */}
          <div className={styles.dayLessons}>
            <h3 className={styles.sectionLabel}>{t('calendar.lesson')}</h3>
            {currentDay.lessons.length > 0 ? (
              currentDay.lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} date={currentDay.date} />
              ))
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>
                  event_busy
                </span>
                <p>{t('calendar.noLessons')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className={styles.weekContainer}>
          {/* Day Headers */}
          <div className={styles.weekHeader}>
            <div className={styles.timeGutter} />
            {data.days.map((day, i) => {
              const isToday = day.date === getLocalDateString()
              return (
                <div key={day.date} className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderActive : ''}`}>
                  <span className={styles.weekDayName}>{dayNames[i]}</span>
                  <span className={`${styles.weekDayNumber} ${isToday ? styles.weekDayNumberActive : ''}`}>
                    {new Date(day.date + 'T00:00:00').getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Time Grid */}
          <div className={styles.weekGrid}>
            {/* Time Gutter */}
            <div className={styles.timeGutter}>
              {HOURS.map(hour => (
                <div key={hour} className={styles.timeSlot}>
                  <span className={styles.timeLabel}>{`${hour.toString().padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {data.days.map((day) => {
              const isToday = day.date === getLocalDateString()
              return (
                <div key={day.date} className={`${styles.dayColumn} ${isToday ? styles.dayColumnActive : ''}`}>
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className={styles.hourCell}
                      onClick={() => {
                        if (userRole !== 'teacher' && userRole !== 'admin') return
                        setSelectedSlot({
                          date: day.date,
                          startTime: `${String(hour).padStart(2, '0')}:00`,
                          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
                          dayOfWeek: day.day_of_week,
                          isNew: true,
                        })
                      }}
                    />
                  ))}

                  {weekOffset === 0 && isToday && (
                    <div
                      className={styles.currentTimeIndicator}
                      style={{ top: `${currentTimeTop}px` }}
                    >
                      <div className={styles.indicatorDot} />
                      <div className={styles.indicatorLine} />
                    </div>
                  )}

                  {/* Lesson Blocks */}
                  {day.lessons.map(lesson => (
                    <LessonBlock key={lesson.id} lesson={lesson} date={day.date} />
                  ))}

                  {/* Availability Blocks — only interactive for teachers/admins */}
                  {day.available_slots?.map((slot, i) => (
                    <AvailabilityBlock
                      key={`avail-${i}`}
                      startTime={slot.start_time}
                      endTime={slot.end_time}
                      isInteractive={userRole === 'teacher' || userRole === 'admin'}
                      onClick={() => {
                        if (userRole !== 'teacher' && userRole !== 'admin') return
                        setSelectedSlot({ date: day.date, startTime: slot.start_time, endTime: slot.end_time, dayOfWeek: day.day_of_week, isNew: false, slotId: slot.id })
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Slot Confirm Modal */}
      {selectedSlot && (
        <div className={styles.slotModalOverlay} onClick={() => setSelectedSlot(null)}>
          <div className={styles.slotModal} onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: selectedSlot.isNew ? 'var(--color-success, #43a047)' : 'var(--color-error, #ba1a1a)' }}>
              {selectedSlot.isNew ? 'event_available' : 'event_busy'}
            </span>
            <h3 className={styles.slotModalTitle}>{selectedSlot.isNew ? t('calendar.openSlotTitle') : t('calendar.closeSlotTitle')}</h3>
            <p className={styles.slotModalText}>{selectedSlot.startTime} — {selectedSlot.endTime}</p>
            <div className={styles.slotModalActions}>
              <button className={styles.slotModalCancel} onClick={() => setSelectedSlot(null)}>
                {t('common.cancel')}
              </button>
              <button
                className={selectedSlot.isNew ? styles.slotModalConfirm : styles.slotModalDelete}
                onClick={async () => {
                  try {
                    if (selectedSlot.isNew) {
                      await createAvailability(selectedSlot.dayOfWeek, selectedSlot.startTime, selectedSlot.endTime)
                    } else if (selectedSlot.slotId) {
                      await deleteAvailability(selectedSlot.slotId)
                    }
                    const fresh = await getCalendar(weekOffset)
                    setData(fresh)
                  } catch (err) {
                    console.error('Error with slot:', err)
                  }
                  setSelectedSlot(null)
                }}
              >
                {selectedSlot.isNew ? t('calendar.openSlot') : t('calendar.closeSlot')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LessonCard({ lesson, date }: { lesson: CalendarLessonOut; date: string }) {
  const navigate = useNavigate()
  const isPrimary = lesson.day_of_week % 2 === 0
  const colorVar = isPrimary ? 'var(--color-primary)' : 'var(--color-tertiary)'
  const isCompleted = lesson.status === 'completed'
  const isUnmarked = lesson.status === 'unmarked'
  const isCancelled = lesson.status === 'cancelled'
  const isAbsent = lesson.status === 'absent'

  const borderColor = isCancelled ? 'var(--color-error, #ba1a1a)'
    : isUnmarked ? 'var(--color-warning, #f59e0b)'
    : isCompleted ? 'var(--color-success, #43a047)'
    : colorVar

  const cardClass = `${styles.lessonCard} ${isCompleted ? styles.lessonCardCompleted : ''} ${isUnmarked ? styles.lessonCardUnmarked : ''} ${isCancelled ? styles.lessonCardCancelled : ''} ${isAbsent ? styles.lessonCardAbsent : ''}`

  return (
    <div
      className={cardClass}
      style={{ borderLeftColor: borderColor, cursor: 'pointer' }}
      onClick={() => navigate(`/lesson/${lesson.id}?date=${date}`)}
    >
      <div className={styles.lessonTime}>
        <span className={styles.lessonStartTime}>{lesson.time}</span>
        <span className={styles.lessonEndTime}>{lesson.end_time}</span>
      </div>
      <div className={styles.lessonInfo}>
        <h4 className={styles.lessonSubject}>
          {isCompleted && (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle' }}>check_circle</span>
          )}
          {isUnmarked && (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: 'var(--color-warning, #f59e0b)' }}>help</span>
          )}
          {isCancelled && (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: 'var(--color-error, #ba1a1a)' }}>cancel</span>
          )}
          {isAbsent && (
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: 'var(--color-error, #ba1a1a)' }}>person_off</span>
          )}
          {lesson.subject_name}
        </h4>
        <div className={styles.lessonMeta}>
          <span className={styles.lessonMetaItem}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>room</span>
            {lesson.room}
          </span>
          <span className={styles.lessonMetaItem}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person</span>
            {lesson.teacher_name}
          </span>
        </div>
      </div>
    </div>
  )
}

function LessonBlock({ lesson, date }: { lesson: CalendarLessonOut; date: string }) {
  const navigate = useNavigate()
  const [startH, startM] = lesson.time.split(':').map(Number)
  const [endH, endM] = lesson.end_time.split(':').map(Number)
  const top = (startH * 80) + (startM / 60 * 80)
  const height = ((endH - startH) * 80) + ((endM - startM) / 60 * 80)
  const isPrimary = lesson.day_of_week % 2 === 0
  const isCompleted = lesson.status === 'completed'
  const isUnmarked = lesson.status === 'unmarked'
  const isCancelled = lesson.status === 'cancelled'

  const bgVar = isCancelled
    ? 'var(--color-surface-container-high)'
    : isCompleted
      ? 'rgba(67, 160, 71, 0.08)'
      : isPrimary
        ? 'var(--color-on-primary-container)'
        : 'var(--color-tertiary-fixed)'
  const borderVar = isCancelled ? 'var(--color-error, #ba1a1a)'
    : isUnmarked ? 'var(--color-warning, #f59e0b)'
    : isCompleted ? 'var(--color-success, #43a047)'
    : isPrimary ? 'var(--color-primary)' : 'var(--color-tertiary)'

  const blockClass = `${styles.lessonBlock} ${isCompleted ? styles.lessonBlockCompleted : ''} ${isUnmarked ? styles.lessonBlockUnmarked : ''} ${isCancelled ? styles.lessonBlockCancelled : ''}`

  const prefix = isCompleted ? '✓ ' : isUnmarked ? '? ' : isCancelled ? '✕ ' : ''

  return (
    <div
      className={blockClass}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: bgVar,
        borderLeftColor: borderVar,
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/lesson/${lesson.id}?date=${date}`)}
    >
      <span className={styles.blockSubject}>
        {prefix}{lesson.subject_name}
      </span>
      <span className={styles.blockTime}>{lesson.time} - {lesson.end_time}</span>
      <span className={styles.blockRoom}>
        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>room</span>
        {lesson.room}
      </span>
    </div>
  )
}

function AvailabilityBlock({ startTime, endTime, isInteractive, onClick }: { startTime: string; endTime: string; isInteractive: boolean; onClick: () => void }) {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const top = (startH * 80) + (startM / 60 * 80)
  const height = ((endH - startH) * 80) + ((endM - startM) / 60 * 80)

  return (
    <div
      className={styles.availabilityBlock}
      style={{ top: `${top}px`, height: `${height}px`, cursor: isInteractive ? 'pointer' : 'default', pointerEvents: isInteractive ? 'auto' : 'none' }}
      onClick={isInteractive ? onClick : undefined}
    />
  )
}
