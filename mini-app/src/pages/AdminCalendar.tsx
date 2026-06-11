import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminLessons, useAdminUsers } from '../api/hooks'
import { rescheduleLesson, cancelAdminLesson, markAdminLessonStatus } from '../api/client'
import type { AdminLessonOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import TimePicker from '../components/TimePicker'
import { Loading } from '../shared/components'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './AdminCalendar.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const getTashkentDate = () => {
  const d = new Date()
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000)
  return new Date(utc + (3600000 * 5))
}

const getLocalDateString = (d: Date = getTashkentDate()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Compute the Monday date string for a given week offset
const getMondayString = (weekOffset: number) => {
  const today = getTashkentDate()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  return getLocalDateString(monday)
}

// Generate 7 date strings starting from a Monday
const getWeekDates = (mondayStr: string) => {
  const dates: string[] = []
  const d = new Date(mondayStr + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(getLocalDateString(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// Group lessons by date
const groupByDate = (lessons: AdminLessonOut[]): Record<string, AdminLessonOut[]> => {
  const map: Record<string, AdminLessonOut[]> = {}
  lessons.forEach(l => {
    if (!map[l.date]) map[l.date] = []
    map[l.date].push(l)
  })
  return map
}

// Group overlapping lessons into clusters for week view rendering.
// Single lessons → render as normal block. Multiple overlapping → single group block with badge.
type LessonCluster =
  | { type: 'single'; lesson: AdminLessonOut }
  | { type: 'group'; lessons: AdminLessonOut[]; time: string; end_time: string }

const buildLessonClusters = (lessons: AdminLessonOut[]): LessonCluster[] => {
  if (lessons.length === 0) return []
  const sorted = [...lessons].sort((a, b) => {
    if (a.time !== b.time) return a.time.localeCompare(b.time)
    return a.end_time.localeCompare(b.end_time)
  })

  const clusters: LessonCluster[] = []
  let i = 0
  while (i < sorted.length) {
    const group: AdminLessonOut[] = [sorted[i]]
    let maxEnd = sorted[i].end_time
    let j = i + 1
    while (j < sorted.length && sorted[j].time < maxEnd) {
      group.push(sorted[j])
      if (sorted[j].end_time > maxEnd) maxEnd = sorted[j].end_time
      j++
    }
    if (group.length === 1) {
      clusters.push({ type: 'single', lesson: group[0] })
    } else {
      clusters.push({ type: 'group', lessons: group, time: group[0].time, end_time: maxEnd })
    }
    i = j
  }
  return clusters
}

// Get status for lesson on its date
const getLessonStatus = (lesson: AdminLessonOut, todayStr: string): string => {
  if (lesson.lesson_status === 'happened') return 'completed'
  if (lesson.lesson_status === 'cancelled') return 'cancelled'
  if (lesson.date === todayStr) return 'today'
  if (lesson.lesson_status === 'rescheduled') return 'rescheduled'
  if (lesson.date < todayStr) return 'unmarked'
  return 'planned'
}

export default function AdminCalendar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t, i18n } = useTranslation()
  const currentLocale = langToLocale(i18n.language)

  const dayNames = Array.from({ length: 7 }, (_, i) => t(`courseDetail.daysShort.${i}`))
  const monthNamesLong = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1)
    const name = d.toLocaleDateString(currentLocale, { month: 'long' })
    return name.charAt(0).toUpperCase() + name.slice(1)
  })
  const monthNamesShort = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1)
    const name = d.toLocaleDateString(currentLocale, { month: 'short' }).replace('.', '')
    return name.charAt(0).toUpperCase() + name.slice(1)
  })

  const [weekOffset, setWeekOffset] = useState(0)
  const [filterMode, setFilterMode] = useState<'teacher' | 'student'>('teacher')
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined)

  const { data: teachers } = useAdminUsers('teacher', { enabled: filterMode === 'teacher' })
  const { data: students } = useAdminUsers('student', { enabled: filterMode === 'student' })

  const hasUserSelected = !!selectedUserId
  const { data: lessons, isLoading, refetch } = useAdminLessons({
    week_offset: weekOffset,
    ...(filterMode === 'teacher' && selectedUserId ? { teacher_id: selectedUserId } : {}),
    ...(filterMode === 'student' && selectedUserId ? { student_id: selectedUserId } : {}),
  }, { enabled: hasUserSelected })
  const lessonList = lessons ?? []
  const [view, setView] = useState<'day' | 'week'>(searchParams.get('view') === 'week' ? 'week' : 'day')
  const [selectedDay, setSelectedDay] = useState(0)
  const [now] = useState(getTashkentDate())
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(getTashkentDate().getFullYear())
  const [selectedLesson, setSelectedLesson] = useState<AdminLessonOut | null>(null)
  const [modalType, setModalType] = useState<'options' | 'reschedule' | 'cancel' | 'status'>('options')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [groupModal, setGroupModal] = useState<AdminLessonOut[] | null>(null)

  // Auto-select today
  useEffect(() => {
    const today = getLocalDateString()
    const monday = getMondayString(weekOffset)
    const dates = getWeekDates(monday)
    const idx = dates.indexOf(today)
    if (idx >= 0) setSelectedDay(idx)
  }, [weekOffset])

  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTimeTop = (currentHour * 80) + (currentMinute / 60 * 80)

  const monday = getMondayString(weekOffset)
  const weekDates = getWeekDates(monday)
  const todayStr = getLocalDateString()

  const byDate = groupByDate(lessonList)
  const currentDate = weekDates[selectedDay]
  const currentLessons = byDate[currentDate] || []

  const monthName = monthNamesLong[new Date(monday + 'T00:00:00').getMonth()]
  const year = new Date(monday + 'T00:00:00').getFullYear()

  const jumpToMonth = (yr: number, month: number) => {
    const today = getTashkentDate()
    const currentMonday = new Date(today)
    currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const firstDay = new Date(yr, month, 1)
    const targetMonday = new Date(firstDay)
    targetMonday.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))
    const diffMs = targetMonday.getTime() - currentMonday.getTime()
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
    setSelectedDay(0)
    setShowMonthPicker(false)
  }

  const handleAction = async () => {
    if (!selectedLesson) return
    setActionLoading(true)
    setActionError('')
    try {
      if (modalType === 'reschedule' && newDate) {
        const data: { date: string; new_date: string; new_time?: string } = { date: selectedLesson.date, new_date: newDate }
        if (newTime) data.new_time = newTime
        await rescheduleLesson(selectedLesson.id, data)
      } else if (modalType === 'cancel') {
        await cancelAdminLesson(selectedLesson.id, { date: selectedLesson.date })
      } else if (modalType === 'status') {
        await markAdminLessonStatus(selectedLesson.id, { date: selectedLesson.date, status: 'happened' })
      }
      await refetch()
      setSelectedLesson(null)
      setModalType('options')
      setNewDate('')
      setNewTime('')
    } catch (err: any) {
      setActionError(err.message || t('admin.calendar.error'))
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('admin.courses.schedule')} onBack={() => navigate('/dashboard')} />

      {/* User Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--color-surface-container-high, #e8e0ec)', borderRadius: 20, overflow: 'hidden' }}>
          {(['teacher', 'student'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setFilterMode(mode); setSelectedUserId(undefined) }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: filterMode === mode ? 'var(--color-primary)' : 'transparent',
                color: filterMode === mode ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {mode === 'teacher' ? t('admin.calendar.filter_teacher', 'Репетитор') : t('admin.calendar.filter_student', 'Ученик')}
            </button>
          ))}
        </div>

        {filterMode === 'teacher' && (
          <select
            value={selectedUserId ?? ''}
            onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)}
            style={{
              padding: '6px 12px',
              borderRadius: 12,
              border: '1px solid var(--color-outline-variant, #c9c0d0)',
              background: 'var(--color-surface, #fdf8ff)',
              color: 'var(--color-on-surface)',
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value="">{t('admin.calendar.select_teacher', 'Выберите репетитора')}</option>
            {(teachers ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name ?? ''}</option>
            ))}
          </select>
        )}

        {filterMode === 'student' && (
          <select
            value={selectedUserId ?? ''}
            onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : undefined)}
            style={{
              padding: '6px 12px',
              borderRadius: 12,
              border: '1px solid var(--color-outline-variant, #c9c0d0)',
              background: 'var(--color-surface, #fdf8ff)',
              color: 'var(--color-on-surface)',
              fontSize: 13,
              minWidth: 140,
            }}
          >
            <option value="">{t('admin.calendar.select_student', 'Выберите ученика')}</option>
            {(students ?? []).map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name ?? ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Calendar Navigation */}
      <div className={styles.calendarNav}>
        <div className={styles.headerLeft}>
          <button className={styles.monthTitleButton} onClick={() => { setPickerYear(year); setShowMonthPicker(!showMonthPicker) }}>
            <h2 className={styles.headerTitle}>{monthName} {year}</h2>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
          </button>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.navButtons}>
            <button className={styles.navButton} onClick={() => setWeekOffset(w => w - 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
            </button>
            <button className={styles.todayButton} onClick={() => { setWeekOffset(0); setSelectedDay((getTashkentDate().getDay() + 6) % 7) }}>
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
          <div className={styles.monthPicker} onClick={e => e.stopPropagation()}>
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
              {monthNamesShort.map((name, i) => (
                <button
                  key={i}
                  className={`${styles.monthButton} ${year === pickerYear && new Date(monday + 'T00:00:00').getMonth() === i ? styles.monthButtonActive : ''}`}
                  onClick={() => jumpToMonth(pickerYear, i)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className={styles.viewToggle}>
        <button className={`${styles.viewButton} ${view === 'day' ? styles.viewButtonActive : ''}`} onClick={() => setView('day')}>
          {t('calendar.dayView')}
        </button>
        <button className={`${styles.viewButton} ${view === 'week' ? styles.viewButtonActive : ''}`} onClick={() => setView('week')}>
          {t('calendar.weekView')}
        </button>
      </div>

      {/* Prompt to select user */}
      {!hasUserSelected && (
        <div className={styles.emptyState} style={{ padding: '48px 16px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>person_search</span>
          <p style={{ marginTop: 12, color: 'var(--color-on-surface-variant)', fontSize: 14 }}>
            {filterMode === 'teacher'
              ? t('admin.calendar.select_teacher_prompt', 'Выберите репетитора для просмотра расписания')
              : t('admin.calendar.select_student_prompt', 'Выберите ученика для просмотра расписания')}
          </p>
        </div>
      )}

      {/* Day View */}
      {hasUserSelected && view === 'day' && (
        <>
          <div className={styles.weekStrip}>
            {weekDates.map((date, i) => (
              <button
                key={date}
                className={`${styles.dayButton} ${i === selectedDay ? styles.dayButtonActive : ''}`}
                onClick={() => setSelectedDay(i)}
              >
                <span className={styles.dayName}>{dayNames[i]}</span>
                <span className={styles.dayNumber}>{new Date(date + 'T00:00:00').getDate()}</span>
              </button>
            ))}
          </div>

          <div className={styles.dayLessons}>
            <h3 className={styles.sectionLabel}>{t('admin.calendar.lessons_section')}</h3>
            {currentLessons.length > 0 ? (
              currentLessons.map(lesson => (
                <AdminLessonCard
                  key={`${lesson.id}-${lesson.date}`}
                  lesson={lesson}
                  todayStr={todayStr}
                  onClick={() => { setSelectedLesson(lesson); setModalType('options'); setActionError('') }}
                />
              ))
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>event_busy</span>
                <p>{t('calendar.noLessons')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Week View */}
      {hasUserSelected && view === 'week' && (
        <div className={styles.weekContainer}>
          <div className={styles.weekHeader}>
            <div className={styles.timeGutter} />
            {weekDates.map((date, i) => {
              const isToday = date === todayStr
              return (
                <div key={date} className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderActive : ''}`}>
                  <span className={styles.weekDayName}>{dayNames[i]}</span>
                  <span className={`${styles.weekDayNumber} ${isToday ? styles.weekDayNumberActive : ''}`}>
                    {new Date(date + 'T00:00:00').getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          <div className={styles.weekGrid}>
            <div className={styles.timeGutter}>
              {HOURS.map(hour => (
                <div key={hour} className={styles.timeSlot}>
                  <span className={styles.timeLabel}>{`${hour.toString().padStart(2, '0')}:00`}</span>
                </div>
              ))}
            </div>

            {weekDates.map((date) => {
              const isToday = date === todayStr
              const dayLessons = byDate[date] || []
              const clusters = buildLessonClusters(dayLessons)
              return (
                <div key={date} className={`${styles.dayColumn} ${isToday ? styles.dayColumnActive : ''}`}>
                  {HOURS.map(hour => (
                    <div key={hour} className={styles.hourCell} />
                  ))}

                  {weekOffset === 0 && isToday && (
                    <div className={styles.currentTimeIndicator} style={{ top: `${currentTimeTop}px` }}>
                      <div className={styles.indicatorDot} />
                      <div className={styles.indicatorLine} />
                    </div>
                  )}

                  {clusters.map((cluster, ci) => {
                    if (cluster.type === 'single') {
                      const lesson = cluster.lesson
                      return (
                        <AdminLessonBlock
                          key={`${lesson.id}-${lesson.date}`}
                          lesson={lesson}
                          todayStr={todayStr}
                          onClick={() => { setSelectedLesson(lesson); setModalType('options'); setActionError('') }}
                        />
                      )
                    }
                    return (
                      <AdminGroupBlock
                        key={`group-${ci}`}
                        lessons={cluster.lessons}
                        time={cluster.time}
                        endTime={cluster.end_time}
                        onClick={() => setGroupModal(cluster.lessons)}
                      />
                    )
                  })}

                  {/* Availability slots (only when filtering by teacher) */}
                  {(dayLessons[0]?.available_slots ?? []).map(slot => (
                    <AvailabilityBlock
                      key={`avail-${slot.id}`}
                      startTime={slot.start_time}
                      endTime={slot.end_time}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lesson Action Modal */}
      {selectedLesson && (
        <div className={styles.slotModalOverlay} onClick={() => { setSelectedLesson(null); setModalType('options') }}>
          <div className={styles.slotModal} onClick={e => e.stopPropagation()}>
            {modalType === 'options' && (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-primary)' }}>event_note</span>
                <h3 className={styles.slotModalTitle}>{selectedLesson.subject_name}</h3>
                <p className={styles.slotModalText}>
                  {selectedLesson.teacher_name} · {selectedLesson.time} — {selectedLesson.end_time}
                </p>
                <div className={styles.slotModalActions}>
                  <button className={styles.slotModalConfirm} onClick={() => { setModalType('status'); setActionError('') }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4 }}>check_circle</span>
                    {t('admin.calendar.status_happened')}
                  </button>
                  <button className={styles.slotModalDelete} onClick={() => { setModalType('cancel'); setActionError('') }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4 }}>cancel</span>
                    {t('admin.calendar.cancel')}
                  </button>
                </div>
                <div className={styles.slotModalActions} style={{ marginTop: 8 }}>
                  <button className={styles.slotModalCancel} onClick={() => { setModalType('reschedule'); setActionError(''); setNewDate(selectedLesson?.date || ''); setNewTime(selectedLesson?.time || '') }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4 }}>schedule</span>
                    {t('admin.calendar.reschedule')}
                  </button>
                </div>
                <div className={styles.slotModalActions} style={{ marginTop: 8 }}>
                  <button className={styles.slotModalCancel} onClick={() => navigate(`/admin/lessons/${selectedLesson.id}?date=${selectedLesson.date}`)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4 }}>open_in_new</span>
                    {t('admin.calendar.open_lesson')}
                  </button>
                </div>
              </>
            )}

            {modalType === 'status' && (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-success, #43a047)' }}>check_circle</span>
                <h3 className={styles.slotModalTitle}>{t('admin.calendar.happened_question')}</h3>
                <p className={styles.slotModalText}>
                  {selectedLesson.subject_name} · {selectedLesson.date}
                </p>
                {actionError && <p className={styles.modalError}>{actionError}</p>}
                <div className={styles.slotModalActions}>
                  <button className={styles.slotModalCancel} onClick={() => setModalType('options')}>{t('common.back')}</button>
                  <button className={styles.slotModalConfirm} onClick={handleAction} disabled={actionLoading}>
                    {actionLoading ? '...' : t('admin.calendar.confirm')}
                  </button>
                </div>
              </>
            )}

            {modalType === 'cancel' && (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-error, #ba1a1a)' }}>cancel</span>
                <h3 className={styles.slotModalTitle}>{t('admin.calendar.cancel_question')}</h3>
                <p className={styles.slotModalText}>
                  {selectedLesson.subject_name} · {selectedLesson.date}
                </p>
                {actionError && <p className={styles.modalError}>{actionError}</p>}
                <div className={styles.slotModalActions}>
                  <button className={styles.slotModalCancel} onClick={() => setModalType('options')}>{t('common.back')}</button>
                  <button className={styles.slotModalDelete} onClick={handleAction} disabled={actionLoading}>
                    {actionLoading ? '...' : t('admin.calendar.cancel')}
                  </button>
                </div>
              </>
            )}

            {modalType === 'reschedule' && (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#d97706' }}>schedule</span>
                <h3 className={styles.slotModalTitle}>{t('admin.calendar.reschedule_lesson')}</h3>
                <p className={styles.slotModalText}>
                  {selectedLesson.subject_name} · {selectedLesson.teacher_name}
                </p>
                <div className={styles.modalField}>
                  <label className={styles.modalFieldLabel}>{t('admin.calendar.new_date')}</label>
                  <input
                    type="date"
                    className={styles.modalInput}
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                  />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalFieldLabel}>{t('admin.calendar.new_time_optional')}</label>
                  <TimePicker
                    value={newTime}
                    onChange={val => setNewTime(val)}
                  />
                </div>
                {actionError && <p className={styles.modalError}>{actionError}</p>}
                <div className={styles.slotModalActions}>
                  <button className={styles.slotModalCancel} onClick={() => setModalType('options')}>{t('common.back')}</button>
                  <button className={styles.slotModalConfirm} onClick={handleAction} disabled={actionLoading || !newDate}>
                    {actionLoading ? '...' : t('admin.calendar.reschedule')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Group List Modal — shows overlapping lessons */}
      {groupModal && (
        <div className={styles.slotModalOverlay} onClick={() => setGroupModal(null)}>
          <div className={styles.groupModal} onClick={e => e.stopPropagation()}>
            <div className={styles.groupModalHeader}>
              <h3 className={styles.slotModalTitle}>{t('admin.calendar.lessons_at_this_time')}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setGroupModal(null)}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <p className={styles.slotModalText}>{groupModal[0].time} — {groupModal[0].end_time}</p>
            <div className={styles.groupList}>
              {groupModal.map(lesson => {
                const status = getLessonStatus(lesson, todayStr)
                const borderColor = status === 'completed' ? 'var(--color-success, #43a047)'
                  : status === 'cancelled' ? 'var(--color-error, #ba1a1a)'
                  : status === 'unmarked' ? 'var(--color-warning, #f59e0b)'
                  : status === 'rescheduled' ? '#d97706'
                  : 'var(--color-primary)'
                return (
                  <button
                    key={`${lesson.id}-${lesson.date}`}
                    className={styles.groupItem}
                    style={{ borderLeftColor: borderColor }}
                    onClick={() => {
                      setGroupModal(null)
                      setSelectedLesson(lesson)
                      setModalType('options')
                      setActionError('')
                    }}
                  >
                    <div className={styles.groupItemInfo}>
                      <span className={styles.groupItemSubject}>{lesson.subject_name}</span>
                      <span className={styles.groupItemMeta}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>person</span>
                        {lesson.teacher_name}
                        {lesson.room && ` · ${lesson.room}`}
                      </span>
                    </div>
                    <button
                      className={styles.groupItemOpen}
                      onClick={e => {
                        e.stopPropagation()
                        setGroupModal(null)
                        navigate(`/admin/lessons/${lesson.id}?date=${lesson.date}`)
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
                    </button>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-on-surface-variant)', opacity: 0.5 }}>chevron_right</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminLessonCard({ lesson, todayStr, onClick }: { lesson: AdminLessonOut; todayStr: string; onClick: () => void }) {
  const status = getLessonStatus(lesson, todayStr)
  const isCompleted = status === 'completed'
  const isUnmarked = status === 'unmarked'
  const isCancelled = status === 'cancelled'
  const isRescheduled = status === 'rescheduled'

  const borderColor = isCancelled ? 'var(--color-error, #ba1a1a)'
    : isRescheduled ? '#d97706'
    : isUnmarked ? 'var(--color-warning, #f59e0b)'
    : isCompleted ? 'var(--color-success, #43a047)'
    : 'var(--color-primary)'

  const cardClass = `${styles.lessonCard} ${isCompleted ? styles.lessonCardCompleted : ''} ${isUnmarked ? styles.lessonCardUnmarked : ''} ${isCancelled ? styles.lessonCardCancelled : ''} ${isRescheduled ? styles.lessonCardRescheduled : ''}`

  return (
    <div className={cardClass} style={{ borderLeftColor: borderColor, cursor: 'pointer' }} onClick={onClick}>
      <div className={styles.lessonTime}>
        <span className={styles.lessonStartTime}>{lesson.time}</span>
        <span className={styles.lessonEndTime}>{lesson.end_time}</span>
      </div>
      <div className={styles.lessonInfo}>
        <h4 className={styles.lessonSubject}>
          {isCompleted && <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle' }}>check_circle</span>}
          {isUnmarked && <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: 'var(--color-warning, #f59e0b)' }}>help</span>}
          {isCancelled && <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: 'var(--color-error, #ba1a1a)' }}>cancel</span>}
          {isRescheduled && <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: 4, verticalAlign: 'middle', color: '#d97706' }}>schedule</span>}
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
          {lesson.student_count > 0 && (
            <span className={styles.lessonMetaItem}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>group</span>
              {lesson.student_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AdminLessonBlock({ lesson, todayStr, onClick }: { lesson: AdminLessonOut; todayStr: string; onClick: () => void }) {
  const [startH, startM] = lesson.time.split(':').map(Number)
  const [endH, endM] = lesson.end_time.split(':').map(Number)
  const top = (startH * 80) + (startM / 60 * 80)
  const height = ((endH - startH) * 80) + ((endM - startM) / 60 * 80)

  const status = getLessonStatus(lesson, todayStr)
  const isCompleted = status === 'completed'
  const isUnmarked = status === 'unmarked'
  const isCancelled = status === 'cancelled'
  const isRescheduled = status === 'rescheduled'

  const bgVar = isCancelled
    ? 'var(--color-surface-container-high)'
    : isCompleted
      ? 'rgba(67, 160, 71, 0.08)'
      : isRescheduled
        ? 'rgba(245, 158, 11, 0.08)'
        : 'var(--color-on-primary-container)'
  const borderVar = isCancelled ? 'var(--color-error, #ba1a1a)'
    : isRescheduled ? '#d97706'
    : isUnmarked ? 'var(--color-warning, #f59e0b)'
    : isCompleted ? 'var(--color-success, #43a047)'
    : 'var(--color-primary)'

  const blockClass = `${styles.lessonBlock} ${isCompleted ? styles.lessonBlockCompleted : ''} ${isUnmarked ? styles.lessonBlockUnmarked : ''} ${isCancelled ? styles.lessonBlockCancelled : ''} ${isRescheduled ? styles.lessonBlockRescheduled : ''}`

  const prefix = isCompleted ? '✓ ' : isUnmarked ? '? ' : isCancelled ? '✕ ' : isRescheduled ? '↻ ' : ''

  return (
    <div
      className={blockClass}
      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: bgVar, borderLeftColor: borderVar, cursor: 'pointer' }}
      onClick={onClick}
    >
      <span className={styles.blockSubject}>{prefix}{lesson.subject_name}</span>
      <span className={styles.blockTime}>{lesson.time} - {lesson.end_time}</span>
      <span className={styles.blockTeacher}>
        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>person</span>
        {lesson.teacher_name}
      </span>
    </div>
  )
}

function AdminGroupBlock({ lessons, time, endTime, onClick }: { lessons: AdminLessonOut[]; time: string; endTime: string; onClick: () => void }) {
  const { t } = useTranslation()
  const [startH, startM] = time.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const top = (startH * 80) + (startM / 60 * 80)
  const height = ((endH - startH) * 80) + ((endM - startM) / 60 * 80)

  return (
    <div
      className={styles.groupBlock}
      style={{ top: `${top}px`, height: `${height}px`, cursor: 'pointer' }}
      onClick={onClick}
    >
      <span className={styles.groupBlockBadge}>{t('admin.calendar.lessons_count', { count: lessons.length })}</span>
      <span className={styles.groupBlockTime}>{time} - {endTime}</span>
      <span className={styles.groupBlockTeachers}>
        {lessons.slice(0, 3).map(l => l.teacher_name).join(', ')}
        {lessons.length > 3 && ` +${lessons.length - 3}`}
      </span>
    </div>
  )
}

function AvailabilityBlock({ startTime, endTime }: { startTime: string; endTime: string }) {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const top = (startH * 80) + (startM / 60 * 80)
  const height = ((endH - startH) * 80) + ((endM - startM) / 60 * 80)

  return (
    <div
      className={styles.availabilityBlock}
      style={{ top: `${top}px`, height: `${height}px` }}
    />
  )
}
