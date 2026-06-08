import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getAdminSubjects,
  adminSearchCourses,
} from '../api/client'
import type { SearchResultOut, AdminSubjectOut } from '../shared/types'
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

  const selectTab = (t: Tab) => {
    setTab(t)
    setSearchParams({ tab: t })
  }

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
        {tab === 'all' && <AllCourses navigate={navigate} />}
        {tab === 'search' && <SearchView />}
      </main>
    </div>
  )
}

function AllCourses({ navigate }: { navigate: (p: string) => void }) {
  const [courses, setCourses] = useState<AdminSubjectOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminSubjects()
      .then(data => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        setCourses(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
