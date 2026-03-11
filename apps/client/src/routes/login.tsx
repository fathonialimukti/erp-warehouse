import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button, Card, Input } from '@heroui/react'
import { trpc } from '#/utils/trpc'
import {
  setAuthSession,
} from '#/state/auth'
import { requireGuest } from '#/lib/route-guard'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    await requireGuest()
  },
  component: Login,
})

function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: async (data: any) => {
        const primaryRole = data.user.roles[0]
        setAuthSession({
          tokenExpiresAt: data.tokenExpiresAt,
          permissions: primaryRole?.permissions ?? [],
          userName: data.user.name,
          roleName: primaryRole?.name ?? null,
        })
        await queryClient.invalidateQueries()
        await navigate({ to: '/dashboard' })
      },
    }),
  )

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    onSubmit: async ({ value }) => {
      await loginMutation.mutateAsync(value)
    },
  })

  return (
    <main className="mx-auto grid min-h-screen w-[min(1120px,calc(100%-2rem))] items-stretch gap-4 py-6 md:grid-cols-[1.1fr_0.9fr] md:py-10">
      <Card variant="secondary" className="rise-in p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-default-500">
          ERP Warehouse
        </p>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.8rem)] font-semibold leading-[1.08] text-default-900">
          Operational control, refined for teams.
        </h1>
        <p className="mt-3 max-w-[52ch] text-sm leading-7 text-default-600 md:text-base">
          Sign in to access warehouse visibility, role-based controls, and
          transaction workflows in one secure workspace.
        </p>
      </Card>

      <Card variant="default" className="rise-in p-8" style={{ animationDelay: '80ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-default-500">
          Sign In
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-default-900">Welcome back</h2>
        <form
          className="mt-4 grid gap-3.5"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Work email is required'
                const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                return validEmail.test(value) ? undefined : 'Invalid email address'
              },
            }}
          >
            {(field) => (
              <>
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-default-500"
                  htmlFor={field.name}
                >
                  Work Email
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="name@company.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  fullWidth
                  required
                />
                {field.state.meta.errors.length > 0 && field.state.meta.isTouched ? (
                  <p className="text-xs font-medium text-danger">
                    {field.state.meta.errors.join(', ')}
                  </p>
                ) : null}
              </>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) =>
                value.length > 0 ? undefined : 'Password is required',
            }}
          >
            {(field) => (
              <>
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-default-500"
                  htmlFor={field.name}
                >
                  Password
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  placeholder="Enter your password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  fullWidth
                  required
                />
                {field.state.meta.errors.length > 0 && field.state.meta.isTouched ? (
                  <p className="text-xs font-medium text-danger">
                    {field.state.meta.errors.join(', ')}
                  </p>
                ) : null}
              </>
            )}
          </form.Field>

          <form.Field name="rememberMe">
            {(field) => (
              <label className="inline-flex items-center gap-2 text-sm text-default-600" htmlFor={field.name}>
                <input
                  id={field.name}
                  name={field.name}
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(event) => field.handleChange(event.target.checked)}
                />
                Keep me signed in
              </label>
            )}
          </form.Field>

          {loginMutation.error ? (
            <p className="text-sm font-medium text-danger">{loginMutation.error.message}</p>
          ) : null}

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                variant="primary"
                isDisabled={!canSubmit || isSubmitting || loginMutation.isPending}
                fullWidth
              >
                {isSubmitting || loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </Button>
            )}
          />
        </form>
      </Card>
    </main>
  )
}
