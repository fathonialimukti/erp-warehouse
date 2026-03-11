import { Button, Card } from '@heroui/react'
import { Link, useRouter } from '@tanstack/react-router'
import { AppLayout } from './AppLayout'
import { getAuthSession, clearAuthSession } from '#/state/auth'

export function NotFound() {
  const router = useRouter()
  const session = getAuthSession()
  const isAuthenticated = session.userName && session.permissions.length > 0

  // If not authenticated, show simple 404 without layout
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-default-50 to-default-100 p-4">
        <Card className="w-full max-w-md rounded-2xl border border-default-200/80 p-8 text-center backdrop-blur-md">
          <div className="mb-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-danger/10">
              <svg
                className="h-12 w-12 text-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="mb-2 text-5xl font-bold text-default-900">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-default-700">Page Not Found</h2>
          <p className="mb-8 text-sm text-default-500">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link to="/login" className="w-full">
            <Button variant="primary" size="md" fullWidth>
              Go to Login
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  // If authenticated, show 404 within AppLayout
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
        <Card className="w-full max-w-md rounded-2xl border border-default-200/80 p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-danger/10">
              <svg
                className="h-12 w-12 text-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          <h1 className="mb-2 text-5xl font-bold text-default-900">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-default-700">Page Not Found</h2>
          <p className="mb-8 text-sm text-default-500">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link to="/dashboard" className="w-full">
            <Button variant="primary" size="md" fullWidth>
              Back to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    </AppLayout>
  )
}
