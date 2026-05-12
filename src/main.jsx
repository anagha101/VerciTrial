import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import './index.css'
import App from './App.jsx'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing #root element in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
