import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Button, Card, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAuthActions } from '../lib/useAuth';
import { useAtomValue } from 'jotai';
import { isAuthenticatedAtom } from '../lib/atoms';

function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const { login } = useAuthActions();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const highlights = [
    {
      title: 'Centralized Operations',
      description: 'Monitor warehouse activity, SKU movement, and access control from one place.',
      icon: 'solar:buildings-2-linear',
    },
    {
      title: 'Secure Role Access',
      description: 'Permission-driven modules keep operators, approvers, and admins in the right workflow.',
      icon: 'solar:shield-user-linear',
    },
    {
      title: 'Reliable Audit Trail',
      description: 'Every critical action is traceable, reducing ambiguity during daily operations.',
      icon: 'solar:clipboard-check-linear',
    },
  ];

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await login(value);
        navigate('/dashboard', { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        setSubmitError(message);
      }
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Card className="grid w-full overflow-hidden rounded-[2rem] border border-border/70 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur md:grid-cols-[1.1fr_0.9fr] dark:bg-surface/92">
      <div className="relative overflow-hidden border-b border-border/60 bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(30,41,59,0.96)_42%,rgba(37,99,235,0.88))] p-8 text-white md:border-r md:border-b-0 md:p-10">
        <div className="absolute top-0 right-0 h-44 w-44 translate-x-1/3 -translate-y-1/3 rounded-full bg-white/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 -translate-x-1/3 translate-y-1/3 rounded-full bg-cyan-300/15 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between gap-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              <Icon icon="solar:shield-keyhole-linear" className="size-4" />
              Secure ERP Access
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/55">Warehouse Control Center</p>
              <h1 className="max-w-md text-3xl leading-tight font-semibold sm:text-4xl">
                Professional operations start with a disciplined sign-in flow.
              </h1>
              <p className="max-w-lg text-sm leading-6 text-white/72 sm:text-base">
                Access inventory, warehouse master data, approvals, and activity logs from one operational dashboard.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {highlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-white/12 text-white">
                    <Icon icon={item.icon} className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-white/68">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.92))] p-8 md:p-10 dark:bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(17,24,39,0.92))]">
        <Card.Header>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              <Icon icon="solar:login-2-linear" className="size-4" />
              Sign In
            </div>
            <div>
              <Card.Title>Welcome back</Card.Title>
              <Card.Description>
                Use your company credentials to continue to the ERP workspace.
              </Card.Description>
            </div>
          </div>
        </Card.Header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="mt-8 space-y-5"
        >
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => (!value ? 'Email is required' : undefined),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label className="form-label" htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  variant="secondary"
                  fullWidth
                  autoComplete="email"
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => (!value ? 'Password is required' : undefined),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="form-label" htmlFor="password">Password</label>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Protected session</span>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  variant="secondary"
                  fullWidth
                  autoComplete="current-password"
                />
                {field.state.meta.errors[0] ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          {submitError ? (
            <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 px-4 py-3 text-sm text-danger">
              <div className="flex items-start gap-2">
                <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            </div>
          ) : null}

          <Button type="submit" variant="primary" fullWidth isPending={form.state.isSubmitting}>
            {({ isPending }) => (
              <>
                <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:login-3-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                {isPending ? 'Signing In...' : 'Sign In to Dashboard'}
              </>
            )}
          </Button>
        </form>

        <Card.Footer>
          <div className="mt-8 flex w-full items-center justify-between gap-3 border-t border-border/60 pt-5 text-xs text-muted">
            <div className="flex items-center gap-2">
              <Icon icon="solar:lock-keyhole-linear" className="size-4" />
              Session is protected and permission-aware.
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Icon icon="solar:server-square-cloud-linear" className="size-4" />
              ERP Warehouse Suite
            </div>
          </div>
        </Card.Footer>
      </div>
    </Card>
  );
}

export { LoginPage };
