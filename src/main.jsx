import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ConfirmProvider, ToastProvider } from './features/shared'
import { registerSW } from 'virtual:pwa-register'

// Automatically check and update service worker in background
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfirmProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ConfirmProvider>
  </StrictMode>,
)
