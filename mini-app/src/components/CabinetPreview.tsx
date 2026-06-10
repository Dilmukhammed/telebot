import { useTranslation } from 'react-i18next'
import { CENTER } from '../config'
import styles from './CabinetPreview.module.css'

export default function CabinetPreview() {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      {/* TopAppBar */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>school</span>
            <span className={styles.headerTitle}>{CENTER.name}</span>
          </div>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>account_circle</span>
        </div>
      </header>

      <main className={styles.main}>
        {/* Welcome Card */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeContent}>
            <h2 className={styles.welcomeTitle}>{t('components.cabinetPreview.welcomeStudent')}</h2>
            <p className={styles.welcomeSubtitle}>{t('components.cabinetPreview.welcomeTo', { name: CENTER.name })}</p>
          </div>
          <div className={styles.welcomeDecor} />
        </section>

        {/* Stats Row */}
        <section className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>5</span>
            <span className={styles.statLabel}>{t('components.cabinetPreview.courses')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>12</span>
            <span className={styles.statLabel}>{t('components.cabinetPreview.lessons')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>85%</span>
            <span className={styles.statLabel}>{t('components.cabinetPreview.progress')}</span>
          </div>
        </section>

        {/* Quick Actions */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('components.cabinetPreview.quickActions')}</h3>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>menu_book</span>
              <span className={styles.actionLabel}>{t('components.cabinetPreview.myCourses')}</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>calendar_today</span>
              <span className={styles.actionLabel}>{t('components.cabinetPreview.schedule')}</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>assignment</span>
              <span className={styles.actionLabel}>{t('components.cabinetPreview.homeworks')}</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>bar_chart</span>
              <span className={styles.actionLabel}>{t('components.cabinetPreview.grades')}</span>
            </div>
          </div>
        </section>

        {/* Upcoming */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('components.cabinetPreview.upcomingLessons')}</h3>
          <div className={styles.placeholderCard}>
            <div className={styles.placeholderLine} style={{ width: '70%' }} />
            <div className={styles.placeholderLine} style={{ width: '50%' }} />
          </div>
          <div className={styles.placeholderCard}>
            <div className={styles.placeholderLine} style={{ width: '60%' }} />
            <div className={styles.placeholderLine} style={{ width: '40%' }} />
          </div>
        </section>
      </main>

      {/* BottomNavBar */}
      <nav className={styles.bottomNav}>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>home</span>
          <span className={styles.navLabel}>{t('components.cabinetPreview.home')}</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">menu_book</span>
          <span className={styles.navLabel}>{t('components.cabinetPreview.navCourses')}</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">person</span>
          <span className={styles.navLabel}>{t('components.cabinetPreview.cabinet')}</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">contact_support</span>
          <span className={styles.navLabel}>{t('components.cabinetPreview.help')}</span>
        </div>
      </nav>
    </div>
  )
}
