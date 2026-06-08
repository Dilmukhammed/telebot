import { CENTER } from '../config'
import styles from './CabinetPreview.module.css'

export default function CabinetPreview() {
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
            <h2 className={styles.welcomeTitle}>Привет, Ученик!</h2>
            <p className={styles.welcomeSubtitle}>Добро пожаловать в {CENTER.name}</p>
          </div>
          <div className={styles.welcomeDecor} />
        </section>

        {/* Stats Row */}
        <section className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>5</span>
            <span className={styles.statLabel}>Курсов</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>12</span>
            <span className={styles.statLabel}>Занятий</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>85%</span>
            <span className={styles.statLabel}>Прогресс</span>
          </div>
        </section>

        {/* Quick Actions */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Быстрые действия</h3>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>menu_book</span>
              <span className={styles.actionLabel}>Мои курсы</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>calendar_today</span>
              <span className={styles.actionLabel}>Расписание</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>assignment</span>
              <span className={styles.actionLabel}>Домашки</span>
            </div>
            <div className={styles.actionCard}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>bar_chart</span>
              <span className={styles.actionLabel}>Оценки</span>
            </div>
          </div>
        </section>

        {/* Upcoming */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Ближайшие занятия</h3>
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
          <span className={styles.navLabel}>Главная</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">menu_book</span>
          <span className={styles.navLabel}>Курсы</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">person</span>
          <span className={styles.navLabel}>Кабинет</span>
        </div>
        <div className={styles.navItem}>
          <span className="material-symbols-outlined">contact_support</span>
          <span className={styles.navLabel}>Помощь</span>
        </div>
      </nav>
    </div>
  )
}
