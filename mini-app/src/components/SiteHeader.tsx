import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CENTER } from '../config'
import styles from './SiteHeader.module.css'

interface SiteHeaderProps {
  avatarUrl?: string | null
  title?: string
  onBack?: () => void
  hideProfile?: boolean
}

export default function SiteHeader({ title, onBack, hideProfile: _hideProfile, avatarUrl: _avatarUrl }: SiteHeaderProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        {onBack ? (
          <div className={styles.headerLeftBack}>
            <button className={styles.backButton} onClick={onBack} aria-label={t('common.back', { defaultValue: 'Назад' })}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                arrow_back
              </span>
            </button>
            {title && <h1 className={styles.headerPageTitle}>{title}</h1>}
          </div>
        ) : title ? (
          <div className={styles.headerLeftBack}>
            <h1 className={styles.headerPageTitle}>{title}</h1>
          </div>
        ) : (
          <div className={styles.headerLeft} onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <div className={styles.logoIcon}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                function
              </span>
            </div>
            <span className={styles.headerTitle}>{CENTER.name}</span>
          </div>
        )}
      </div>
    </header>
  )
}