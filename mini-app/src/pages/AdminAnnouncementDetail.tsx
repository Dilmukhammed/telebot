import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminAnnouncementDetail, useAdminAnnouncementRecipients, useMarkAnnouncementRead } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './AnnouncementDetail.module.css'

const formatDate = (isoString: string, locale: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(locale, {
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
  const { t, i18n } = useTranslation()
  const currentLocale = langToLocale(i18n.language)
  const numId = Number(id)
  const { data: announcement, isLoading, error } = useAdminAnnouncementDetail(numId)
  const { data: recipients = [] } = useAdminAnnouncementRecipients(numId)
  const markReadMutation = useMarkAnnouncementRead()
  const hasMarkedRead = useRef(false)
  const [showAllRecipients, setShowAllRecipients] = useState(false)

  useEffect(() => {
    if (announcement && numId && !hasMarkedRead.current && !markReadMutation.isPending) {
      hasMarkedRead.current = true
      markReadMutation.mutate(numId)
    }
  }, [announcement, numId])

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !announcement) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('admin.announcements.detail_title')} onBack={() => navigate(-1)} />
        <div className={styles.errorState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>error</span>
          <p>{error?.message || t('common.error')}</p>
          <button onClick={() => navigate(-1)} className={styles.backButton}>{t('common.back')}</button>
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
      <SiteHeader title={t('admin.announcements.detail_title')} onBack={() => navigate(-1)} />

      <main className={styles.main}>
        <div className={styles.card}>
          {announcement.sender_name && (
            <span className={styles.sender}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                admin_panel_settings
              </span>
              {announcement.sender_name} · {t('admin.dashboard.role_admin')}
            </span>
          )}
          {announcement.title && (
            <h2 className={styles.title}>{announcement.title}</h2>
          )}
          <span className={styles.date}>{formatDate(announcement.sent_at, currentLocale)}</span>
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
              {t('admin.announcements.recipients_count', { count: announcement.recipient_count })}
            </div>
          </div>
        </div>

        {/* Recipients list */}
        {recipients.length > 0 && (
          <div className={styles.recipientsSection}>
            <div className={styles.recipientsHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>group</span>
              <span className={styles.recipientsTitle}>
                {t('admin.announcements.students_count', { count: recipients.length })}
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
                {t('admin.announcements.show_all_recipients', { count: recipients.length })}
              </button>
            )}
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
