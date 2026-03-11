import { redirect } from '@tanstack/react-router'
import { getAuthSession, setAuthSession, clearAuthSession, isTokenExpired } from '#/state/auth'
import { hasAllPermissions, hasAnyPermission } from '#/lib/permission'
import { queryClient, trpc } from '#/utils/trpc'

export type RouteGuardConfig = {
  requiredAnyPermissions?: string[]
  requiredAllPermissions?: string[]
}

/**
 * Middleware: Ensures user is authenticated
 * Redirects to /login if auth check fails
 * Updates session with fresh token data on success
 */
export async function requireAuth() {
  console.log('[requireAuth] Starting auth check for protected route')
  try {
    // Always check with the server because auth token is in HTTP-only cookie
    // Force fresh check by setting staleTime to 0 for this specific query
    console.log('[requireAuth] Fetching auth.me from server...')
    const me = await queryClient.fetchQuery({
      ...trpc.auth.me.queryOptions(),
      staleTime: 0,
    })
    console.log('[requireAuth] Server responded - user is authenticated:', me.user)
    const primaryRole = me.user.roles[0]

    // Update session with fresh data
    setAuthSession({
      tokenExpiresAt: me.tokenExpiresAt,
      permissions: primaryRole?.permissions ?? [],
      userName: me.user.name,
      roleName: primaryRole?.name ?? null,
    })
    console.log('[requireAuth] Session updated successfully')
  } catch (error) {
    console.log('[requireAuth] Caught error:', error)
    // Re-throw redirect errors (from TanStack Router) so they actually redirect
    // TanStack Router redirect() throws a Response object with 3xx status
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      console.log('[requireAuth] Re-throwing redirect Response')
      throw error
    }
    if (error && typeof error === 'object' && 'isRedirect' in error) {
      console.log('[requireAuth] Re-throwing redirect error (isRedirect)')
      throw error
    }
    // Token verification failed or no token exists, clear session and redirect to login
    console.log('[requireAuth] Auth check failed, clearing session and redirecting to login')
    clearAuthSession()
    throw redirect({ to: '/login' })
  }
}

/**
 * Middleware: Ensures user is NOT authenticated (for login page)
 * Redirects to /dashboard if user is already logged in
 */
export async function requireGuest() {
  console.log('[requireGuest] Starting auth check for login page')
  try {
    // Always check with the server because auth token is in HTTP-only cookie
    // Force fresh check by setting staleTime to 0 for this specific query
    console.log('[requireGuest] Fetching auth.me from server...')
    const me = await queryClient.fetchQuery({
      ...trpc.auth.me.queryOptions(),
      staleTime: 0,
    })
    console.log('[requireGuest] Server responded - user is authenticated:', me.user)
    const primaryRole = me.user.roles[0]

    // Token is valid, update session and redirect to dashboard
    setAuthSession({
      tokenExpiresAt: me.tokenExpiresAt,
      permissions: primaryRole?.permissions ?? [],
      userName: me.user.name,
      roleName: primaryRole?.name ?? null,
    })
    console.log('[requireGuest] Session updated, redirecting to dashboard...')

    // User is authenticated, redirect to dashboard
    throw redirect({ to: '/dashboard' })
  } catch (error) {
    console.log('[requireGuest] Caught error:', error)
    // Re-throw redirect errors (from TanStack Router) so they actually redirect
    // TanStack Router redirect() throws a Response object with 3xx status
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      console.log('[requireGuest] Re-throwing redirect Response')
      throw error
    }
    if (error && typeof error === 'object' && 'isRedirect' in error) {
      console.log('[requireGuest] Re-throwing redirect error (isRedirect)')
      throw error
    }
    // Token verification failed or no token exists, clear session and allow guest access
    console.log('[requireGuest] Auth check failed, clearing session and allowing guest access')
    clearAuthSession()
    return
  }
}

export async function checkRoutePermission(config: RouteGuardConfig) {
  const session = getAuthSession()
  const permissions = session.permissions || []

  if (config.requiredAnyPermissions) {
    if (!hasAnyPermission(permissions, config.requiredAnyPermissions)) {
      throw redirect({ to: '/dashboard' })
    }
  }

  if (config.requiredAllPermissions) {
    if (!hasAllPermissions(permissions, config.requiredAllPermissions)) {
      throw redirect({ to: '/dashboard' })
    }
  }
}

export function createProtectedRouteLoader(config: RouteGuardConfig) {
  return async () => {
    await requireAuth()
    await checkRoutePermission(config)
  }
}
