import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'

const TITLES: Record<string, string> = {
  '/registrations': 'Мои записи',
  '/results': 'Мои результаты',
}

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  useEffect(() => {
    if (!isHome) {
      try {
        WebApp.BackButton.show()
        WebApp.BackButton.onClick(handleBack)
      } catch { /* outside Telegram */ }
    }
    return () => {
      try {
        WebApp.BackButton.offClick(handleBack)
        WebApp.BackButton.hide()
      } catch { /* outside Telegram */ }
    }
  }, [isHome, handleBack])

  if (isHome) return null

  const title = location.pathname.startsWith('/test/')
    ? 'Регистрация'
    : TITLES[location.pathname] || ''

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'var(--tg-bg-color, #fff)',
      borderBottom: '1px solid var(--color-gray-200, #eee)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <button
        onClick={handleBack}
        aria-label="Назад"
        style={{
          background: 'none',
          border: 'none',
          fontSize: '22px',
          cursor: 'pointer',
          padding: '4px 8px 4px 0',
          color: 'var(--tg-button-color, #2481cc)',
          lineHeight: 1,
        }}
      >
        ←
      </button>
      {title && (
        <h1 style={{
          fontSize: '17px',
          fontWeight: 600,
          color: 'var(--tg-text-color, #000)',
          margin: 0,
          marginLeft: '4px',
        }}>
          {title}
        </h1>
      )}
    </header>
  )
}