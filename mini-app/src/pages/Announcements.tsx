import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAnnouncements, getTeacherAnnouncements } from '../api/client'
import { useUser } from '../context/UserContext'
import type { AnnouncementOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Announcements.module.css'

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

export default function Announcements() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isPrivileged = user && (user.role === 'teacher' || user.role === 'admin')
    const fetcher = isPrivileged ? getTeacherAnnouncements() : getAnnouncements()
    fetcher
      .then(setAnnouncements)
      .catch(() => getAnnouncements().then(setAnnouncements))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('announcements.title')} onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        {announcements.length > 0 ? (
          <div className={styles.list}>
            {announcements.map((item) => (
              <div
                key={item.id}
                className={styles.card}
                onClick={() => navigate(`/announcement/${item.id}`)}
              >
                <div className={styles.cardContent}>
                  {item.sender_name && (
                    <span className={styles.cardSender}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {item.sender_role === 'teacher' ? 'school' : 'admin_panel_settings'}
                      </span>
                      {item.sender_name} · {item.sender_role === 'teacher' ? t('profile.teacher') : t('profile.admin')}
                    </span>
                  )}
                  {item.title && (
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                  )}
                  <p className={styles.cardMessage}>
                    {item.message.length > 120
                      ? item.message.slice(0, 120) + '...'
                      : item.message}
                  </p>
                  <span className={styles.cardDate}>{formatDate(item.sent_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>
              campaign
            </span>
            <p>{t('announcements.noAnnouncements')}</p>
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
