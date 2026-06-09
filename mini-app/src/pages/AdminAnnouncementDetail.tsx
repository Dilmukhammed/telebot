import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAdminAnnouncementDetail, useAdminAnnouncementRecipients } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './AnnouncementDetail.module.css'

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ru-RU', {
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

const PREVIEW_COUNT = 5

export default function AdminAnnouncementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = Number(id)
  const { data: announcement, isLoading, error } = useAdminAnnouncementDetail(numId)
  const { data: recipients = [] } = useAdminAnnouncementRecipients(numId)
  const [showAllRecipients, setShowAllRecipients] = useState(false)

  if (isLoading) {
    return <Loading fullPage message="Загрузка..." />
  }

  if (error || !announcement) {
    return (
      <div className={styles.page}>
        <SiteHeader title="Объявление" onBack={() => navigate(-1)} hideProfile />
        <div className={styles.errorState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>error</span>
          <p>{error?.message || 'Ошибка загрузки'}</p>
          <button onClick={() => navigate(-1)} className={styles.backButton}>Назад</button>
        </div>
      </div>
    )
  }

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, PREVIEW_COUNT)
  const hasMore = recipients.length > PREVIEW_COUNT

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'course': return 'menu_book'
      case 'teacher_courses': return 'school'
      case 'specific_students': return 'person_search'
      case 'teachers': return 'school'
      case 'students': return 'group'
      default: return 'campaign'
    }
  }

  return (
    <div className={styles.page}>
      <SiteHeader title="Объявление" onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        <div className={styles.card}>
          {announcement.sender_name && (
            <span className={styles.sender}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                admin_panel_settings
              </span>
              {announcement.sender_name} · Администратор
            </span>
          )}
          {announcement.title && (
            <h2 className={styles.title}>{announcement.title}</h2>
          )}
          <span className={styles.date}>{formatDate(announcement.sent_at)}</span>
          <div className={styles.divider} />
          <p className={styles.message}>{announcement.message}</p>
        </div>

        {/* Target info */}
        <div className={styles.recipientsSection}>
          <div className={styles.recipientsHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
              {getTargetIcon(announcement.target_type)}
            </span>
            <span className={styles.recipientsTitle}>
              {announcement.target_summary}
            </span>
          </div>
          <div className={styles.recipientsList}>
            <div className={styles.recipientChip}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>people</span>
              {announcement.recipient_count} получателей
            </div>
          </div>
        </div>

        {/* Recipients list */}
        {recipients.length > 0 && (
          <div className={styles.recipientsSection}>
            <div className={styles.recipientsHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>group</span>
              <span className={styles.recipientsTitle}>
                Ученики ({recipients.length})
              </span>
            </div>
            <div className={styles.recipientsList}>
              {visibleRecipients.map((r) => (
                <div key={r.id} className={styles.recipientChip}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
                  {r.first_name}{r.username ? ` (@${r.username})` : ''}
                </div>
              ))}
            </div>
            {hasMore && !showAllRecipients && (
              <button
                className={styles.showAllButton}
                onClick={() => setShowAllRecipients(true)}
              >
                Показать всех ({recipients.length})
              </button>
            )}
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
