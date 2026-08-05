import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { useIntl } from 'react-intl';
import {
  Button,
  Checkbox,
  FieldError,
  FieldGroup,
  Form,
  InputGroup,
  Label,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAuthActions } from '../lib/useAuth';
import { useAtomValue } from 'jotai';
import { isAuthenticatedAtom } from '../lib/atoms';

const SIDE_FEATURES = [
  {
    icon: 'solar:clipboard-check-linear',
    titleId: 'auth.login.side_feature_audit_title',
    descId: 'auth.login.side_feature_audit_desc',
    titleDefault: 'Full audit trail',
    descDefault:
      'Every inbound, outbound, and transfer action is traceable to the actor, pallet, and timestamp.',
  },
  {
    icon: 'solar:shield-user-linear',
    titleId: 'auth.login.side_feature_permission_title',
    descId: 'auth.login.side_feature_permission_desc',
    titleDefault: 'Role-based access',
    descDefault:
      'Operators, approvers, and admins each see only the modules and actions they are permitted to use.',
  },
  {
    icon: 'solar:graph-up-linear',
    titleId: 'auth.login.side_feature_realtime_title',
    descId: 'auth.login.side_feature_realtime_desc',
    titleDefault: 'Live warehouse state',
    descDefault:
      'Pallets, storage locations, and inventory balances stay in sync across every transaction in real time.',
  },
] as const;

function LoginPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const { login } = useAuthActions();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await login({ email: value.email, password: value.password });
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
    <div
      data-ai-context={JSON.stringify({ section: 'auth', view: 'login' })}
      className="grid w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-surface shadow-[0_32px_90px_-20px_rgba(15,23,42,0.28)] md:grid-cols-[1.08fr_0.92fr]"
    >
      {/* ── Left: branded operational panel ── */}
      <aside className="relative flex flex-col justify-between gap-12 overflow-hidden bg-[linear-gradient(155deg,rgba(12,18,32,0.98)_0%,rgba(22,32,52,0.96)_42%,rgba(37,99,235,0.78)_100%)] p-9 text-white md:p-12">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-indigo-400/18 blur-[5rem]" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-cyan-400/14 blur-[4.5rem]" />
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/7 px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur-sm">
            <Icon icon="solar:shield-keyhole-linear" className="size-3.5" />
            {intl.formatMessage({ id: 'auth.login.side_subhead', defaultMessage: 'Warehouse Control Center' })}
          </div>

          <div className="space-y-4">
            <h1 className="max-w-md text-[2.625rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.875rem]">
              {intl.formatMessage({
                id: 'auth.login.headline',
                defaultMessage: 'Operational control, one sign-in away.',
              })}
            </h1>
            <p className="max-w-lg text-[0.9375rem] leading-7 text-white/65">
              {intl.formatMessage({
                id: 'auth.login.description',
                defaultMessage: 'Sign in with your company credentials to access the ERP workspace.',
              })}
            </p>
          </div>
        </div>

        <div className="relative grid gap-3">
          {SIDE_FEATURES.map((feature) => (
            <div
              key={feature.titleId}
              className="group rounded-2xl border border-white/8 bg-white/4 p-4 backdrop-blur-sm transition-colors duration-200 hover:border-white/20 hover:bg-white/7"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-white/15 to-white/5 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                  <Icon icon={feature.icon} className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-[0.9375rem] font-semibold leading-tight text-white">
                    {intl.formatMessage({ id: feature.titleId, defaultMessage: feature.titleDefault })}
                  </p>
                  <p className="text-[0.8125rem] leading-5 text-white/55">
                    {intl.formatMessage({ id: feature.descId, defaultMessage: feature.descDefault })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex items-center gap-2.5 text-[0.6875rem] text-white/55">
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
          </span>
          <span className="font-semibold uppercase tracking-[0.16em] text-white/45">
            {intl.formatMessage({ id: 'auth.login.side_status_label', defaultMessage: 'System status' })}
          </span>
          <span className="font-medium text-white/80">
            {intl.formatMessage({
              id: 'auth.login.side_status_value',
              defaultMessage: 'All services operational',
            })}
          </span>
        </div>
      </aside>

      {/* ── Right: sign-in form ── */}
      <div className="flex flex-col justify-center gap-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(248,250,252,0.5))] p-8 dark:bg-[linear-gradient(180deg,rgba(18,24,38,0.45),rgba(17,24,39,0.32))] md:p-12">
        <div className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/75 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted backdrop-blur-sm">
            <Icon icon="solar:shield-check-linear" className="size-3.5 text-accent" />
            {intl.formatMessage({ id: 'auth.login.security_badge', defaultMessage: 'Secure workspace' })}
          </div>
          <div className="space-y-1.5">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted">
              {intl.formatMessage({ id: 'auth.login.badge', defaultMessage: 'Warehouse Operations' })}
            </p>
            <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              {intl.formatMessage({ id: 'auth.login.welcome', defaultMessage: 'Welcome back' })}
            </h2>
            <p className="text-[0.9375rem] leading-6 text-muted">
              {intl.formatMessage({
                id: 'auth.login.form_subtitle',
                defaultMessage: 'Use your assigned work credentials to reach inventory, approvals, and warehouse operations.',
              })}
            </p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-border/60 bg-background/80 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-border/45 bg-surface/70 px-3.5 py-3 text-[0.8125rem] leading-6 text-muted">
            <Icon icon="solar:lock-password-linear" className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>
              {intl.formatMessage({
                id: 'auth.login.supporting_copy',
                defaultMessage: 'Access is protected by role-aware permissions and session controls for the warehouse team.',
              })}
            </span>
          </div>

          <Form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <div className="space-y-5">
              {/* Inputs */}
              <FieldGroup>
              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? intl.formatMessage({
                          id: 'auth.login.email_required',
                          defaultMessage: 'Email is required',
                        })
                      : undefined,
                }}
              >
                {(field) => (
                  <TextField
                    isRequired
                    isInvalid={field.state.meta.errors.length > 0}
                    fullWidth
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <Label>{intl.formatMessage({ id: 'auth.login.email_label', defaultMessage: 'Email' })}</Label>
                    <InputGroup variant="secondary">
                      <InputGroup.Prefix>
                        <Icon icon="solar:letter-linear" className="size-4 text-muted" />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type="email"
                        autoComplete="email"
                        placeholder={intl.formatMessage({
                          id: 'auth.login.email_placeholder',
                          defaultMessage: 'you@company.com',
                        })}
                      />
                    </InputGroup>
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  </TextField>
                )}
              </form.Field>

              <form.Field
                name="password"
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? intl.formatMessage({
                          id: 'auth.login.password_required',
                          defaultMessage: 'Password is required',
                        })
                      : undefined,
                }}
              >
                {(field) => (
                  <TextField
                    isRequired
                    isInvalid={field.state.meta.errors.length > 0}
                    fullWidth
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <Label>{intl.formatMessage({ id: 'auth.login.password_label', defaultMessage: 'Password' })}</Label>
                    <InputGroup variant="secondary">
                      <InputGroup.Prefix>
                        <Icon icon="solar:lock-password-linear" className="size-4 text-muted" />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder={intl.formatMessage({
                          id: 'auth.login.password_placeholder',
                          defaultMessage: 'Enter your password',
                        })}
                      />
                      <InputGroup.Suffix>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={
                            showPassword
                              ? intl.formatMessage({ id: 'auth.login.password_toggle_hide', defaultMessage: 'Hide password' })
                              : intl.formatMessage({ id: 'auth.login.password_toggle_show', defaultMessage: 'Show password' })
                          }
                          onPress={() => setShowPassword((prev) => !prev)}
                        >
                          <Icon icon={showPassword ? 'solar:eye-linear' : 'solar:eye-closed-linear'} className="size-4 text-muted" />
                        </Button>
                      </InputGroup.Suffix>
                    </InputGroup>
                    <FieldError>{field.state.meta.errors[0]}</FieldError>
                  </TextField>
                )}
              </form.Field>
            </FieldGroup>

            {/* Options */}
            <div>
              <form.Field name="rememberMe">
                {(field) => (
                  <Checkbox isSelected={field.state.value} onChange={field.handleChange}>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <span className="text-[0.8125rem] text-muted">
                        {intl.formatMessage({ id: 'auth.login.remember_label', defaultMessage: 'Keep me signed in' })}
                      </span>
                    </Checkbox.Content>
                  </Checkbox>
                )}
              </form.Field>
            </div>

            {/* Error */}
            {submitError ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/6 px-3.5 py-2.5 text-[0.8125rem] text-danger">
                <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold leading-tight">
                    {intl.formatMessage({ id: 'auth.login.error_title', defaultMessage: 'Sign-in failed' })}
                  </p>
                  <p className="leading-5 text-danger/80">{submitError}</p>
                </div>
              </div>
            ) : null}
          </div>

            {/* Action — separated with clear breathing room */}
            <div className="mt-8">
              <Button type="submit" variant="primary" fullWidth isPending={form.state.isSubmitting}>
                {({ isPending }) => (
                  <>
                    <Icon
                      icon={isPending ? 'solar:refresh-linear' : 'solar:login-3-linear'}
                      className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                    />
                    {isPending
                      ? intl.formatMessage({ id: 'auth.login.submit_pending', defaultMessage: 'Signing in…' })
                      : intl.formatMessage({ id: 'auth.login.submit_title', defaultMessage: 'Sign in to dashboard' })}
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-border/40 pt-5 text-[0.6875rem] text-muted">
          <Icon icon="solar:shield-check-linear" className="size-3.5" />
          {intl.formatMessage({ id: 'auth.login.footer_secure', defaultMessage: 'Session is protected and permission-aware.' })}
        </div>
      </div>
    </div>
  );
}

export { LoginPage };
