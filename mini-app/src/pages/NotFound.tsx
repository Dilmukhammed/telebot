import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SiteHeader from '../components/SiteHeader'

export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SiteHeader title="404" onBack={() => navigate(-1)} />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '64px', color: 'var(--color-outline)' }}>
          search_off
        </span>
        <h2 style={{ margin: 0, color: 'var(--color-on-surface)' }}>
          {t('notFound.title', 'Страница не найдена')}
        </h2>
        <p style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
          {t('notFound.message', 'Запрашиваемая страница не существует')}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            marginTop: '8px',
            padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {t('notFound.goHome', 'На главную')}
        </button>
      </div>
    </div>
  )
}
