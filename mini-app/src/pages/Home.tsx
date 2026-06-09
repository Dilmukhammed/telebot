import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTests } from '../api/client'
import type { TestOut } from '../shared/types'
import { Card, Loading, ErrorBanner, EmptyState } from '../shared/components'
import { formatDateTime, langToLocale } from '../shared/utils/formatDate'
import styles from './Home.module.css'

const ALL_FILTER = '__all__'

export default function Home() {
  const { t, i18n } = useTranslation()
  const [tests, setTests] = useState<TestOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER)
  const navigate = useNavigate()

  const locale = langToLocale(i18n.language)

  useEffect(() => {
    getTests()
      .then((data) => {
        const now = new Date()
        const activeTests = data.filter((t) => new Date(t.datetime) > now)
        setTests(activeTests)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false))
  }, [t])

  const subjects = useMemo(() => {
    const set = new Set(tests.map((t) => t.subject_name))
    return [ALL_FILTER, ...Array.from(set).sort()]
  }, [tests])

  const filteredTests = useMemo(() => {
    if (activeFilter === ALL_FILTER) return tests
    return tests.filter((t) => t.subject_name === activeFilter)
  }, [tests, activeFilter])

  const formatTestDateTime = (datetime: string) => {
    return formatDateTime(datetime, locale)
  }

  if (loading) return <Loading fullPage message={t('common.loading')} data-testid="loading" />
  if (error) return <ErrorBanner message={error} onRetry={() => { setError(null); setLoading(true); getTests().then(setTests).catch((err) => setError(err.message)).finally(() => setLoading(false)) }} data-testid="error-banner" />
  if (filteredTests.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyState
          title={t('test.noTests')}
          message={t('test.noTestsMessage')}
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
            {subject === ALL_FILTER ? t('common.all') : subject}
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
                {test.format === 'online' ? t('test.online') : t('test.offline')}
              </span>
            </div>
            <div className={styles.datetime}>{formatTestDateTime(test.datetime)}</div>
            <div className={styles.capacity}>
              <span className={styles.capacityLabel}>{t('test.spots')}:</span>
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
