import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTests } from '../api/client'
import type { TestOut } from '../shared/types'
import { Card, Loading, ErrorBanner, EmptyState } from '../shared/components'
import styles from './Home.module.css'

export default function Home() {
  const { t } = useTranslation()
  const [tests, setTests] = useState<TestOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('Все')
  const navigate = useNavigate()

  useEffect(() => {
    getTests()
      .then((data) => {
        const now = new Date()
        const activeTests = data.filter((t) => new Date(t.datetime) > now)
        setTests(activeTests)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  const subjects = useMemo(() => {
    const set = new Set(tests.map((t) => t.subject_name))
    return ['Все', ...Array.from(set).sort()]
  }, [tests])

  const filteredTests = useMemo(() => {
    if (activeFilter === 'Все') return tests
    return tests.filter((t) => t.subject_name === activeFilter)
  }, [tests, activeFilter])

  const formatDateTime = (datetime: string) => {
    const d = new Date(datetime)
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <Loading fullPage message={t('common.loading')} data-testid="loading" />
  if (error) return <ErrorBanner message={error} data-testid="error-banner" />
  if (filteredTests.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState
          title="Нет доступных тестов"
          message="Пока нет запланированных тестов по выбранному предмету"
          data-testid="empty-state"
        />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        {subjects.map((subject) => (
          <button
            key={subject}
            className={`${styles.filterChip} ${activeFilter === subject ? styles.filterChipActive : ''}`}
            onClick={() => setActiveFilter(subject)}
            data-testid={`subject-filter-${subject}`}
          >
            {subject}
          </button>
        ))}
      </div>
      <div className={styles.list}>
        {filteredTests.map((test) => (
          <Card
            key={test.id}
            onClick={() => navigate(`/test/${test.id}`)}
            data-testid="test-card"
            className={styles.card}
          >
            <div className={styles.cardHeader}>
              <span className={styles.subject}>{test.subject_name}</span>
              <span
                className={`${styles.badge} ${test.format === 'online' ? styles.badgeOnline : styles.badgeOffline}`}
              >
                {test.format === 'online' ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
            <div className={styles.datetime}>{formatDateTime(test.datetime)}</div>
            <div className={styles.capacity}>
              <span className={styles.capacityLabel}>Мест:</span>
              <span
                className={`${styles.capacityValue} ${!test.has_capacity ? styles.capacityFull : ''}`}
              >
                {test.registered_count}/{test.max_capacity}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
