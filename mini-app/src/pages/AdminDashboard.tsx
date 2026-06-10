import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminStats, useAnnouncements } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const currentLocale = langToLocale(i18n.language)
  const { data: stats, isLoading } = useAdminStats()
  const { data: announcements = [] } = useAnnouncements('admin')
  const unreadCount = announcements.filter(a => !a.is_read).length

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (!stats) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{t('common.error')}</div>
      </div>
    )
  }

  // Mini-calendar widget date calculation (Tashkent Time)
  const today = new Date(Date.now() + 5 * 60 * 60 * 1000)
  const dayNum = today.getUTCDate()
  const isEn = i18n.language?.startsWith('en')
  const isUz = i18n.language?.startsWith('uz')
  const monthsRu = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК']
  const monthsEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const monthsUz = ['YAN', 'FEV', 'MAR', 'APR', 'MAY', 'IYN', 'IYL', 'AVG', 'SEN', 'OKT', 'NOY', 'DEK']
  const daysRu = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']
  const daysEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const daysUz = ['YAK', 'DUSH', 'SESH', 'CHOR', 'PAY', 'JUM', 'SHAN']
  const calendarMonth = (isEn ? monthsEn : isUz ? monthsUz : monthsRu)[today.getUTCMonth()] || ''
  const calendarDayName = (isEn ? daysEn : isUz ? daysUz : daysRu)[today.getUTCDay()] || ''

  return (
    <div className={styles.page}>
      <SiteHeader avatarUrl={telegramAvatar} announcementCount={unreadCount} announcementPath="/admin/announcements" />

      <main>
        {/* Welcome Card */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeLeft}>
            <h1 className={styles.welcomeTitle}>{t('admin.dashboard.title')}</h1>
            <p className={styles.welcomeSub}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                admin_panel_settings
              </span>
              {t('admin.dashboard.role_admin')} &middot; EduCenter &middot; {new Date().toLocaleDateString(currentLocale, { day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className={styles.welcomeCalendarWidget}>
            <div className={styles.widgetHeader}>
              {calendarMonth}
            </div>
            <div className={styles.widgetBody}>
              <span className={styles.widgetDayNum}>{dayNum}</span>
              <span className={styles.widgetDayName}>{calendarDayName}</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className={styles.section}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard} onClick={() => navigate('/admin/people')}>
              <span className="material-symbols-outlined">group</span>
              <span className={styles.statValue}>{stats.student_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.students')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/people?tab=teachers')}>
              <span className="material-symbols-outlined">school</span>
              <span className={styles.statValue}>{stats.teacher_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.teachers')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">menu_book</span>
              <span className={styles.statValue}>{stats.course_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.courses')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">quiz</span>
              <span className={styles.statValue}>{stats.active_tests}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.tests')}</span>
            </div>
          </div>
        </section>

        {/* Quick Action — Search */}
        <section className={styles.section}>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard} onClick={() => navigate('/admin/courses?tab=search')}>
              <span className="material-symbols-outlined">search</span>
              {t('admin.dashboard.find_slots')}
            </div>
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
