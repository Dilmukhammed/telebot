import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getAdminSubjects,
  adminSearchCourses,
  createAdminSubject,
  getAdminUsers,
} from '../api/client'
import type { SearchResultOut, AdminSubjectOut, UserOut, ScheduleSlot } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminCourses.module.css'

type Tab = 'all' | 'search'

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const COURSE_ICONS: Record<string, string> = {
  'SAT Math': 'school',
  'Олимпиадная Математика': 'architecture',
  'Курсы для Абитуриентов': 'menu_book',
}

const COURSE_BADGES: Record<string, string> = {
  'SAT Math': 'Math Expert',
  'Олимпиадная Математика': 'Olympiad',
  'Курсы для Абитуриентов': 'Abiturient',
}

export default function AdminCourses() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [courses, setCourses] = useState<AdminSubjectOut[]>([])

  const selectTab = (t: Tab) => {
    setTab(t)
    setSearchParams({ tab: t })
  }

  const fetchCourses = () => {
    getAdminSubjects()
      .then(data => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        setCourses(sorted)
      })
      .catch(console.error)
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  return (
    <div className={styles.page}>
      <SiteHeader title="Курсы" onBack={() => navigate('/dashboard')} hideProfile />

      <main className={styles.main}>
        <div className={styles.tabs}>
          {([['all', 'Курсы'], ['search', 'Поиск']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`}
              onClick={() => selectTab(t)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'all' && <AllCourses navigate={navigate} courses={courses} loading={false} />}
        {tab === 'search' && <SearchView />}
      </main>

      {/* FAB - Create Course */}
      {tab === 'all' && (
        <button className={styles.fab} onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined">add</span>
        </button>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <CreateCourseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false)
            fetchCourses()
            navigate(`/admin/courses/${id}`)
          }}
        />
      )}
    </div>
  )
}

function AllCourses({ navigate, courses, loading }: { navigate: (p: string) => void; courses: AdminSubjectOut[]; loading: boolean }) {
  if (loading) return <div className={styles.loading}>Загрузка курсов...</div>

  if (courses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>menu_book</span>
        <p>Нет курсов</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {courses.map(c => (
        <div
          key={c.id}
          className={styles.courseCard}
          onClick={() => navigate(`/admin/courses/${c.id}`)}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <span className={styles.badge}>
                {COURSE_BADGES[c.name] || 'Курс'}
              </span>
              <h2 className={styles.courseTitle}>{c.name}</h2>
            </div>
            <div className={styles.cardRight}>
              <div className={styles.cardIcon}>
                <span className="material-symbols-outlined">
                  {COURSE_ICONS[c.name] || 'school'}
                </span>
              </div>
              <span className={`material-symbols-outlined ${styles.courseChevron}`}>
                chevron_right
              </span>
            </div>
          </div>

          <div className={styles.teacherRow}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              person
            </span>
            <span className={styles.teacherName}>
              {c.teacher_names.join(', ') || 'Без преподавателя'}
            </span>

            <span className={styles.metaDivider}>·</span>

            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              menu_book
            </span>
            <span className={styles.teacherName}>{c.lesson_count} ур.</span>

            <span className={styles.metaDivider}>·</span>

            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              groups
            </span>
            <span className={styles.teacherName}>{c.student_count} уч.</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Create Course Modal ──────────────────────────────────────────────

type Step = 'info' | 'teacher' | 'schedule' | 'students'

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isIndefinite, setIsIndefinite] = useState(true)
  const [durationWeeks, setDurationWeeks] = useState('12')
  const [durationMinutes, setDurationMinutes] = useState('90')
  const [maxCapacity, setMaxCapacity] = useState('15')

  // Step 2: Teacher
  const [teachers, setTeachers] = useState<UserOut[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)

  // Step 3: Schedule
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([
    { day_of_week: 0, time: '16:00', room: '' }
  ])

  // Step 4: Students
  const [students, setStudents] = useState<UserOut[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  // Load teachers when reaching step 2
  useEffect(() => {
    if (step === 'teacher' && teachers.length === 0) {
      getAdminUsers({ role: 'teacher' }).then(setTeachers).catch(console.error)
    }
  }, [step])

  // Load students when reaching step 4
  useEffect(() => {
    if (step === 'students' && students.length === 0) {
      getAdminUsers({ role: 'student' }).then(setStudents).catch(console.error)
    }
  }, [step])

  const steps: { key: Step; label: string; icon: string }[] = [
    { key: 'info', label: 'Инфо', icon: 'info' },
    { key: 'teacher', label: 'Учитель', icon: 'person' },
    { key: 'schedule', label: 'Расписание', icon: 'schedule' },
    { key: 'students', label: 'Ученики', icon: 'groups' },
  ]

  const currentIdx = steps.findIndex(s => s.key === step)

  const canNext = () => {
    if (step === 'info') return name.trim().length > 0
    if (step === 'teacher') return true // teacher is optional
    if (step === 'schedule') return schedule.length > 0 && schedule.every(s => s.time && s.room)
    if (step === 'students') return true // students are optional
    return false
  }

  const handleNext = () => {
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1].key)
    }
  }

  const handleBack = () => {
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1].key)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createAdminSubject({
        name: name.trim(),
        description: description.trim() || undefined,
        duration_weeks: isIndefinite ? undefined : (parseInt(durationWeeks) || 12),
        duration_minutes: parseInt(durationMinutes) || 90,
        teacher_id: selectedTeacherId || undefined,
        max_capacity: parseInt(maxCapacity) || 15,
        schedule,
        student_ids: selectedStudentIds,
      })
      onCreated(result.id)
    } catch (err: any) {
      setError(err?.message || 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  const addScheduleSlot = () => {
    setSchedule([...schedule, { day_of_week: 0, time: '16:00', room: '' }])
  }

  const removeScheduleSlot = (idx: number) => {
    setSchedule(schedule.filter((_, i) => i !== idx))
  }

  const updateScheduleSlot = (idx: number, field: keyof ScheduleSlot, value: string | number) => {
    const updated = [...schedule]
    updated[idx] = { ...updated[idx], [field]: value }
    setSchedule(updated)
  }

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase()
    const username = (s.username || '').toLowerCase()
    return name.includes(q) || username.includes(q)
  })

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3>Новый курс</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          {steps.map((s, idx) => (
            <div
              key={s.key}
              className={`${styles.stepDot} ${idx === currentIdx ? styles.stepDotActive : idx < currentIdx ? styles.stepDotDone : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {idx < currentIdx ? 'check' : s.icon}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {error && <div className={styles.modalError}>{error}</div>}

          {/* Step 1: Basic Info */}
          {step === 'info' && (
            <>
              <div className={styles.formGroup}>
                <label>Название курса *</label>
                <input type="text" placeholder="SAT Math" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Описание</label>
                <input type="text" placeholder="Подготовка к экзамену..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isIndefinite}
                  onChange={e => setIsIndefinite(e.target.checked)}
                />
                <span>Бессрочный курс</span>
              </label>
              {!isIndefinite && (
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Недель</label>
                    <input type="number" min="1" value={durationWeeks} onChange={e => setDurationWeeks(e.target.value)} />
                  </div>
                </div>
              )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Минут/урок</label>
                  <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>Макс. учеников</label>
                  <input type="number" min="1" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Teacher */}
          {step === 'teacher' && (
            <>
              <p className={styles.stepHint}>Выберите преподавателя или пропустите</p>
              <div className={styles.teacherList}>
                <button
                  className={`${styles.teacherCard} ${selectedTeacherId === null ? styles.teacherCardActive : ''}`}
                  onClick={() => setSelectedTeacherId(null)}
                >
                  <span className="material-symbols-outlined">person_off</span>
                  <span>Без преподавателя</span>
                </button>
                {teachers.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.teacherCard} ${selectedTeacherId === t.id ? styles.teacherCardActive : ''}`}
                    onClick={() => setSelectedTeacherId(t.id)}
                  >
                    <div className={styles.teacherAvatar}>
                      {t.first_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className={styles.teacherInfo}>
                      <span className={styles.teacherCardName}>
                        {t.first_name} {t.last_name || ''}
                      </span>
                      {t.username && <span className={styles.teacherCardUsername}>@{t.username}</span>}
                    </div>
                  </button>
                ))}
                {teachers.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>Нет преподавателей</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 3: Schedule */}
          {step === 'schedule' && (
            <>
              <p className={styles.stepHint}>Добавьте расписание занятий</p>
              {schedule.map((slot, idx) => (
                <div key={idx} className={styles.scheduleSlot}>
                  <div className={styles.scheduleSlotHeader}>
                    <span className={styles.scheduleSlotNum}>#{idx + 1}</span>
                    {schedule.length > 1 && (
                      <button className={styles.removeSlotBtn} onClick={() => removeScheduleSlot(idx)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      </button>
                    )}
                  </div>
                  <div className={styles.scheduleSlotFields}>
                    <div className={styles.formGroup}>
                      <label>День</label>
                      <select
                        value={slot.day_of_week}
                        onChange={e => updateScheduleSlot(idx, 'day_of_week', parseInt(e.target.value))}
                      >
                        {DAY_NAMES.map((name, i) => (
                          <option key={i} value={i}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Время</label>
                      <input
                        type="time"
                        value={slot.time}
                        onChange={e => updateScheduleSlot(idx, 'time', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Кабинет</label>
                      <input
                        type="text"
                        placeholder="Каб. 1"
                        value={slot.room}
                        onChange={e => updateScheduleSlot(idx, 'room', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button className={styles.addSlotBtn} onClick={addScheduleSlot}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                Добавить слот
              </button>
            </>
          )}

          {/* Step 4: Students */}
          {step === 'students' && (
            <>
              <p className={styles.stepHint}>Выберите учеников или пропустите</p>
              <div className={styles.searchBox}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7b7487' }}>search</span>
                <input
                  type="text"
                  placeholder="Поиск учеников..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.studentList}>
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    className={`${styles.studentCard} ${selectedStudentIds.includes(s.id) ? styles.studentCardActive : ''}`}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <div className={styles.studentCheck}>
                      {selectedStudentIds.includes(s.id) && (
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                      )}
                    </div>
                    <div className={styles.studentInfo}>
                      <span>{s.first_name || s.username || 'Без имени'} {s.last_name || ''}</span>
                      {s.username && <span className={styles.studentUsername}>@{s.username}</span>}
                    </div>
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>Нет учеников</p>
                  </div>
                )}
              </div>
              {selectedStudentIds.length > 0 && (
                <div className={styles.selectedCount}>
                  Выбрано: {selectedStudentIds.length}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {currentIdx > 0 && (
            <button className={styles.cancelBtn} onClick={handleBack}>
              Назад
            </button>
          )}
          {currentIdx === 0 && (
            <button className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
          )}
          {currentIdx < steps.length - 1 ? (
            <button className={styles.createBtn} onClick={handleNext} disabled={!canNext()}>
              Далее
            </button>
          ) : (
            <button className={styles.createBtn} onClick={handleSubmit} disabled={loading || !canNext()}>
              {loading ? 'Создание...' : 'Создать курс'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Search View ──────────────────────────────────────────────────────

function SearchView() {
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [results, setResults] = useState<SearchResultOut | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDays.length === 0) {
      setError('Выберите хотя бы один день')
      return
    }
    setSearching(true)
    setError('')
    try {
      const data = await adminSearchCourses({ days: selectedDays, time_from: timeFrom, time_to: timeTo })
      setResults(data)
    } catch (e: any) {
      setError(e.message || 'Ошибка поиска')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={styles.searchForm}>
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Дни недели</label>
          <div className={styles.dayPicker}>
            {DAY_NAMES.map((name, idx) => (
              <button
                key={name}
                type="button"
                className={`${styles.dayBtn} ${selectedDays.includes(idx) ? styles.dayBtnActive : ''}`}
                onClick={() => toggleDay(idx)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.timeRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>С</label>
            <input type="time" className={styles.timeInput} value={timeFrom} onChange={e => setTimeFrom(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>По</label>
            <input type="time" className={styles.timeInput} value={timeTo} onChange={e => setTimeTo(e.target.value)} />
          </div>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        <button type="submit" className={styles.searchBtn} disabled={searching}>
          {searching ? 'Поиск...' : 'Найти свободные слоты'}
        </button>
      </form>

      {results && (
        <div className={styles.results}>
          <h3 className={styles.resultsTitle}>Совпадающие занятия</h3>
          {results.courses.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>search_off</span>
              <p>Занятий не найдено</p>
            </div>
          ) : (
            results.courses.map(c => (
              <div key={c.id} className={styles.resultCard}>
                <div className={styles.resultName}>{c.name}</div>
                <div className={styles.resultMeta}>
                  {c.teacher_name} · {c.day_name} {c.time}-{c.end_time} · {c.room} · {c.student_count} уч.
                </div>
              </div>
            ))
          )}

          <h3 className={styles.resultsTitle}>Свободные слоты</h3>
          {results.open_slots.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>event_available</span>
              <p>Нет доступных окон</p>
            </div>
          ) : (
            results.open_slots.map((s, idx) => (
              <div key={idx} className={`${styles.resultCard} ${styles.resultCardAccent}`}>
                <div className={styles.resultName}>{s.teacher_name}</div>
                <div className={styles.resultMeta}>
                  {s.day_name} {s.start_time}-{s.end_time}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
