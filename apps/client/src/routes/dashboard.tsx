import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Card } from '@heroui/react'
import { trpc } from '#/utils/trpc'
import { AppLayout } from '#/components/AppLayout'
import {
  clearAuthSession,
  setAuthSession,
} from '#/state/auth'
import { requireAuth } from '#/lib/route-guard'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    await requireAuth()
    return { authenticated: true }
  },
  component: Dashboard,
})

function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useQuery(trpc.auth.me.queryOptions())
  const me = meQuery.data as any | undefined

  useEffect(() => {
    if (me?.tokenExpiresAt && me.user) {
      const primaryRole = me.user.roles[0]
      setAuthSession({
        tokenExpiresAt: me.tokenExpiresAt,
        permissions: primaryRole?.permissions ?? [],
        userName: me.user.name,
        roleName: primaryRole?.name ?? null,
      })
    }
  }, [me])

  useEffect(() => {
    if (meQuery.error) {
      clearAuthSession()
      navigate({ to: '/login' })
    }
  }, [meQuery.error, navigate])

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: async () => {
        clearAuthSession()
        // Remove queries instead of invalidating to prevent refetch with cleared cookie
        queryClient.removeQueries(trpc.auth.me.pathFilter())
        await navigate({ to: '/login' })
      },
      onError: () => {
        // Even if logout fails, clear local session and redirect
        clearAuthSession()
        queryClient.removeQueries(trpc.auth.me.pathFilter())
        navigate({ to: '/login' })
      },
    }),
  )

  if (meQuery.isLoading) {
    return (
      <main className="mx-auto w-full">
        <Card variant="secondary" className="rise-in p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] ">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold ">
            Loading your workspace...
          </h1>
        </Card>
      </main>
    )
  }

  if (meQuery.error || !me?.user) {
    return null
  }

  const user = me.user
  const role = user.roles[0]

  return (
    <AppLayout
      userName={user.name}
      roleName={role?.name ?? 'No role assigned'}
      permissions={role?.permissions ?? []}
      onLogout={() => logoutMutation.mutate()}
      isLoggingOut={logoutMutation.isPending}
    >
      <div className="mx-auto w-full">
        <Card className="rise-in p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] ">
              ERP Warehouse
            </p>
            <h1 className="mt-2 text-[clamp(1.35rem,3vw,2rem)] font-semibold ">
              Good to see you, {user.name}.
            </h1>
            <p className="mt-3 max-w-[66ch] text-sm leading-7  md:text-base">
              Access operational metrics, approvals, and warehouse controls from one
              secured dashboard.
            </p>
          </div>
        </Card>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <Card  className="rise-in p-5" style={{ animationDelay: '80ms' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] ">
              Account
            </p>
            <h2 className="mt-2 text-xl font-semibold ">{user.email}</h2>
            <p className="mt-2 text-sm ">Primary identity for this workspace.</p>
          </Card>

          <Card variant="default" className="rise-in p-5" style={{ animationDelay: '120ms' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] ">
              Role
            </p>
            <h2 className="mt-2 text-xl font-semibold ">
              {role?.name ?? 'No role assigned'}
            </h2>
            <p className="mt-2 text-sm ">
              Permission scope from centralized access control.
            </p>
          </Card>

          <Card variant="default" className="rise-in p-5" style={{ animationDelay: '160ms' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] ">
              Permissions
            </p>
            <h2 className="mt-2 text-xl font-semibold ">
              {role?.permissions.length ?? 0}
            </h2>
            <p className="mt-2 text-sm ">
              Granted actions available in ERP modules.
            </p>
          </Card>
        </section>
      </div>
    </AppLayout>
  )
}
