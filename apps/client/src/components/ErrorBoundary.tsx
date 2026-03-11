import { Button, Card } from '@heroui/react'
import { Link, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { AppLayout } from './AppLayout'
import { getAuthSession, clearAuthSession } from '#/state/auth'

export function ErrorBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const session = getAuthSession()
  const isAuthenticated = session.userName && session.permissions.length > 0

  const handleReset = () => {
    reset()
    router.invalidate()
  }

  const isNotAuthorized = error?.message?.includes('not authorized') || 
                          error?.message?.includes('forbidden') ||
                          error?.message?.includes('permission')

  const errorContent = (
    <Card className="w-full max-w-md rounded-2xl border border-default-200/80 p-8 text-center">
      <div className="mb-6 flex justify-center">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full ${
          isNotAuthorized ? 'bg-warning/10' : 'bg-danger/10'
        }`}>
          <svg
            className={`h-12 w-12 ${isNotAuthorized ? 'text-warning' : 'text-danger'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {isNotAuthorized ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </div>
      </div>

      <h1 className="mb-2 text-4xl font-bold text-default-900">
        {isNotAuthorized ? 'Access Denied' : 'Oops!'}
      </h1>
      <h2 className="mb-4 text-lg font-semibold text-default-700">
        {isNotAuthorized ? 'Insufficient Permissions' : 'Something Went Wrong'}
      </h2>
      <p className="mb-2 text-sm text-default-500">
        {isNotAuthorized
          ? "You don't have permission to access this resource."
          : 'An unexpected error occurred while loading this page.'}
      </p>

      {!isNotAuthorized && (
        <details className="mb-6 text-left">
          <summary className="cursor-pointer text-xs text-default-400 hover:text-default-600">
            Show error details
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-default-100 p-3 text-xs text-danger">
            {error?.message || 'Unknown error'}
          </pre>
        </details>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="primary" size="md" fullWidth onPress={handleReset}>
          Try Again
        </Button>
        {isAuthenticated && (
          <Link to="/dashboard" className="w-full">
            <Button variant="outline" size="md" fullWidth>
              Back to Dashboard
            </Button>
          </Link>
        )}
        {!isAuthenticated && (
          <Link to="/login" className="w-full">
            <Button variant="outline" size="md" fullWidth>
              Go to Login
            </Button>
          </Link>
        )}
      </div>
    </Card>
  )

  // If not authenticated, show simple error without layout
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-default-50 to-default-100 p-4">
        {errorContent}
      </div>
    )
  }

  // If authenticated, show error within AppLayout
  return (
    <AppLayout
      userName={session.userName || 'User'}
      roleName={session.roleName || 'Guest'}
      permissions={session.permissions}
      onLogout={() => {
        clearAuthSession()
        router.navigate({ to: '/login' })
      }}
    >
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center p-4">
        {errorContent}
      </div>
    </AppLayout>
  )
}
