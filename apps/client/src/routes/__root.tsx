import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Suspense } from 'react'
import { NotFound } from '#/components/NotFound'
import { ErrorBoundary } from '#/components/ErrorBoundary'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
})

function RootComponent() {
  return (
    <>
      <Suspense fallback={<PageTransitionLoader />}>
        <Outlet />
      </Suspense>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}

function PageTransitionLoader() {
  return (
    <div className="page-transition-loader">
      <div className="loader-content">
        <div className="loader-spinner" />
        <p className="loader-text">Loading...</p>
      </div>
    </div>
  )
}
