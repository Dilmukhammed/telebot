import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminMore.module.css'

export default function AdminMore() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const items = [
    { icon: 'campaign', label: t('admin.announcements.title'), to: '/admin/announcements' },
    { icon: 'calendar_month', label: t('admin.courses.schedule'), to: '/admin/calendar' },
    { icon: 'search', label: t('admin.dashboard.find_slots'), to: '/admin/courses?tab=search' },
    { icon: 'person', label: t('admin.profile.title'), to: '/profile' },
  ]

  return (
    <div className={styles.page}>
      <SiteHeader title={t('admin.more.title')} onBack={() => navigate('/dashboard')} hideProfile />

      <main className={styles.main}>
        <div className={styles.list}>
          {items.map(item => (
            <button
              key={item.to}
              className={styles.card}
              onClick={() => navigate(item.to)}
            >
              <div className={styles.iconWrap}>
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <span className={styles.label}>{item.label}</span>
              <span className={`material-symbols-outlined ${styles.chevron}`}>chevron_right</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
