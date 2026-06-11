import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { ErrorBoundary } from './ErrorBoundary'
import { QueryProvider } from './providers/QueryProvider'
import { UserProvider } from './context/UserContext'
import './i18n'
import './index.css'
import App from './App.tsx'

try {
  WebApp.ready()
  WebApp.expand()
} catch {
  // Outside Telegram context — that's fine for dev
}

function applyThemeParams() {
  const tp = WebApp.themeParams || {}
  document.documentElement.style.setProperty('--tg-bg-color', tp.bg_color || '#ffffff')
  document.documentElement.style.setProperty('--tg-text-color', tp.text_color || '#000000')
  document.documentElement.style.setProperty('--tg-hint-color', tp.hint_color || '#999999')
  document.documentElement.style.setProperty('--tg-button-color', tp.button_color || '#2481cc')
  document.documentElement.style.setProperty('--tg-button-text-color', tp.button_text_color || '#ffffff')
  document.documentElement.style.setProperty('--tg-secondary-bg-color', tp.secondary_bg_color || '#f0f0f0')
}

applyThemeParams()

// Listen for Telegram theme changes while the mini-app is open
try {
  WebApp.onEvent('themeChanged', applyThemeParams)
} catch {
  // Outside Telegram context
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryProvider>
          <BrowserRouter>
            <UserProvider>
              <App />
            </UserProvider>
          </BrowserRouter>
        </QueryProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}