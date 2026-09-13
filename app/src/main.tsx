import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'
import { ThemeProvider } from './state/theme-context'
import { ConsentBanner } from './components/ConsentBanner'
import { ensureConsentDefaults } from './lib/consent'

// Consent Mode v2 default denied SEBELUM gtag.js ada — wajib sebelum render.
ensureConsentDefaults()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <ConsentBanner />
    </ThemeProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* service worker registration is best-effort */
    })
  })
}
