import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/system-patterns.css'
import App from './App.tsx'
import { appCopy } from './shared/app.copy'
import { applyLastSystemThemeFromStorage } from './styles/systemThemes'
import { SystemErrorBoundary } from './system/shared/errors/SystemErrorBoundary'
import { SystemTooltipProvider } from './system/shared/ui/SystemTooltipProvider'
import { resolveAppEntryRoute } from './appEntryRoute'

applyLastSystemThemeFromStorage()

const ApiTestPage = import.meta.env.DEV
  ? lazy(() =>
      import('./pages/ApiTest/ApiTestPage.tsx').then((module) => ({
        default: module.ApiTestPage,
      })),
    )
  : null

const entryRoute = resolveAppEntryRoute(
  window.location.pathname,
  import.meta.env.DEV,
)

function AppLoading() {
  return (
    <main className="app-loading">
      <img src="/brand/logo-mark.svg" alt="" />
      <span>{appCopy.loading.default}</span>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary boundaryName="application-root" variant="root">
      <SystemTooltipProvider>
        <Suspense fallback={<AppLoading />}>
          {entryRoute === 'api-test' && ApiTestPage ? <ApiTestPage /> : <App />}
        </Suspense>
      </SystemTooltipProvider>
    </SystemErrorBoundary>
  </StrictMode>,
)
