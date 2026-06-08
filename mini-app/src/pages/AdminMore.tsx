import { useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminMore.module.css'

const items = [
  { icon: 'campaign', label: 'Объявления', to: '/admin/announcements' },
  { icon: 'calendar_month', label: 'Расписание', to: '/admin/calendar' },
  { icon: 'search', label: 'Поиск слотов', to: '/admin/courses?tab=search' },
  { icon: 'person', label: 'Профиль', to: '/profile' },
]

export default function AdminMore() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <SiteHeader title="Ещё" onBack={() => navigate('/dashboard')} hideProfile />

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
