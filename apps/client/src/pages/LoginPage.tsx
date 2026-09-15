import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Disclosure,
  FieldError,
  FieldGroup,
  Form,
  InputGroup,
  Label,
  ScrollShadow,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useAuthActions } from '../lib/useAuth';
import { trpcClient } from '../lib/trpc';
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

type DemoUser = Awaited<ReturnType<typeof trpcClient.auth.demoUsers.query>>[number];

const AVATAR_COLORS = ['accent', 'success', 'warning', 'danger', 'default'] as const;

function getInitials(user: DemoUser) {
  const source = (user.role?.name ?? user.email).trim();
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${second}`.toUpperCase();
}

const ROLE_BLURBS: Record<string, { id: string; defaultMessage: string }> = {
  admin: {
    id: 'login.selectUser.roleDesc.admin',
    defaultMessage: 'Full access to everything including users and settings.',
  },
  manager: {
    id: 'login.selectUser.roleDesc.manager',
    defaultMessage: 'Runs the warehouse: all operations, approvals and reports.',
  },
  supervisor: {
    id: 'login.selectUser.roleDesc.supervisor',
    defaultMessage: 'Oversees floor work: assigns tasks and approves receiving/QC.',
  },
  inbound_staff: {
    id: 'login.selectUser.roleDesc.inbound_staff',
    defaultMessage: 'Goods receiving only: inbound receipts, putaway and QC.',
  },
  outbound_staff: {
    id: 'login.selectUser.roleDesc.outbound_staff',
    defaultMessage: 'Outbound only: pick, pack and dispatch.',
  },
  inventory_staff: {
    id: 'login.selectUser.roleDesc.inventory_staff',
    defaultMessage: 'Stock inquiry and cycle counts, requests adjustments.',
  },
  staff: {
    id: 'login.selectUser.roleDesc.staff',
    defaultMessage: 'Read-only overview of stock and operations.',
  },
};

// Rough 2-line cutoff at card width (~0.75rem font): below this the
// line-clamped text never overflows, so the Show more toggle would be noise.
const SHOW_MORE_MIN_LENGTH = 110;

type DemoUserCardProps = {
  user: DemoUser;
  colorIndex: number;
  selected: boolean;
  isPending: boolean;
  isDisabled: boolean;
  onSelect: (userId: string) => void;
  onLogin: (userId: string) => void;
};

function DemoUserCard({ user, colorIndex, selected, isPending, isDisabled, onSelect, onLogin }: DemoUserCardProps) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const displayName = user.role
    ? intl.formatMessage({ id: `roles.${user.role.code}`, defaultMessage: user.role.name })
    : user.email;
  const userDescription = user.description?.trim() ?? '';
  const roleKey = (user.role?.code ?? user.role?.name ?? '').trim().toLowerCase();
  const blurbEntry =
    ROLE_BLURBS[roleKey] ??
    ROLE_BLURBS[(user.role?.name ?? '').trim().toLowerCase()] ??
    (user.role ? ROLE_BLURBS['staff'] : undefined);
  const aboutText = userDescription || (blurbEntry ? intl.formatMessage(blurbEntry) : '');

  const selectLabel = intl.formatMessage(
    { id: 'login.selectUser.selectAs', defaultMessage: 'Select {name}' },
    { name: displayName },
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isDisabled || isPending) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(user.id);
    }
  };

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const loginAriaLabel = intl.formatMessage(
    { id: 'login.selectUser.loginAs', defaultMessage: 'Login as {name}' },
    { name: displayName },
  );

  const showMoreLabel = intl.formatMessage({
    id: 'login.selectUser.showMore',
    defaultMessage: 'Show more',
  });
  const showLessLabel = intl.formatMessage({
    id: 'login.selectUser.showLess',
    defaultMessage: 'Show less',
  });

  return (
    <Card
      role="radio"
      aria-checked={selected}
      aria-label={selectLabel}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : 0}
      onClick={() => {
        if (!isDisabled && !isPending) onSelect(user.id);
      }}
      onKeyDown={handleKeyDown}
      className={`transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        isDisabled && !isPending ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      } ${
        selected
          ? 'border-accent ring-2 ring-accent/30'
          : 'hover:border-accent/40 hover:bg-accent-soft/20'
      }`}
    >
      <Card.Header className="gap-3">
        <Avatar
          size="lg"
          variant="soft"
          color={AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]}
          className="shrink-0"
        >
          <Avatar.Fallback>{getInitials(user)}</Avatar.Fallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Card.Title className="truncate text-[0.9375rem]">{displayName}</Card.Title>
          <Card.Description className="truncate text-[0.8125rem]">{user.email}</Card.Description>
          {aboutText ? (
            <div className="mt-0.5">
              <p
                className={`text-[0.75rem] leading-5 text-muted ${expanded ? '' : 'line-clamp-2'}`}
              >
                {aboutText}
              </p>
              {aboutText.length > SHOW_MORE_MIN_LENGTH ? (
                <div onClick={stopPropagation} onKeyDown={stopPropagation}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((prev) => !prev)}
                    className="mt-0.5 inline-flex items-center gap-0.5 rounded text-[0.6875rem] font-medium text-accent outline-none transition-colors hover:text-accent/80 focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {expanded ? showLessLabel : showMoreLabel}
                    <Icon
                      icon={expanded ? 'solar:chevron-up-linear' : 'solar:chevron-down-linear'}
                      className="size-3"
                    />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card.Header>

      <Card.Content className="gap-3 pt-0">
        <div onClick={stopPropagation} onKeyDown={stopPropagation}>
          <Button
            fullWidth
            size="sm"
            isPending={isPending}
            isDisabled={isDisabled}
            aria-label={loginAriaLabel}
            onPress={() => onLogin(user.id)}
          >
            {({ isPending: pending }) => (
              <>
                <Icon
                  icon={pending ? 'solar:refresh-linear' : 'solar:login-3-linear'}
                  className={`size-4 ${pending ? 'animate-spin' : ''}`}
                />
                {pending
                  ? intl.formatMessage({
                      id: 'login.selectUser.signingIn',
                      defaultMessage: 'Signing in…',
                    })
                  : intl.formatMessage({
                      id: 'login.selectUser.login',
                      defaultMessage: 'Login',
                    })}
              </>
            )}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

type DemoSelectorProps = {
  users: DemoUser[];
  loading: boolean;
  selectedId: string | null;
  pendingId: string | null;
  error: string | null;
  onSelect: (userId: string) => void;
  onLogin: (userId: string) => void;
};

function DemoSelector({
  users,
  loading,
  selectedId,
  pendingId,
  error,
  onSelect,
  onLogin,
}: DemoSelectorProps) {
  const intl = useIntl();

  return (
    <Card>
      <Card.Content className="gap-4">
        {/* Inner scroll area: only the account-selection grid scrolls.
            Error + skeleton + radiogroup stay inside; each card carries
            its own Login button so nothing scrolls away from its user.
            Viewport-aware cap keeps header + password disclosure
            visible without scrolling the page as a whole. */}
        <ScrollShadow className="max-h-[38vh] overflow-y-auto p-1 sm:max-h-[44vh]">
          {error ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2.5 rounded-2xl border border-danger/40 bg-danger-soft/40 px-3.5 py-3 text-[0.8125rem] leading-6 text-danger"
            >
              <Icon icon="solar:danger-triangle-linear" className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div
              aria-busy="true"
              aria-label={intl.formatMessage({
                id: 'login.selectUser.loading',
                defaultMessage: 'Loading demo users…',
              })}
              className="grid grid-cols-1 gap-3"
            >
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="flex animate-pulse items-center gap-3 rounded-2xl border border-border/40 bg-surface/50 p-3.5"
                >
                  <div className="size-12 shrink-0 rounded-full bg-surface-secondary" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 rounded-full bg-surface-secondary" />
                    <div className="h-2.5 w-3/5 rounded-full bg-surface-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label={intl.formatMessage({
                id: 'login.selectUser.groupLabel',
                defaultMessage: 'Demo users',
              })}
              className="grid grid-cols-1 gap-3"
            >
              {users.map((user, index) => (
                <DemoUserCard
                  key={user.id}
                  user={user}
                  colorIndex={index}
                  selected={user.id === selectedId}
                  isPending={user.id === pendingId}
                  isDisabled={pendingId !== null && user.id !== pendingId}
                  onSelect={onSelect}
                  onLogin={onLogin}
                />
              ))}
            </div>
          )}
        </ScrollShadow>
      </Card.Content>
    </Card>
  );
}

function CredentialsForm() {
  const intl = useIntl();
  const navigate = useNavigate();
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

  return (
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
                <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                  <span className="text-muted">
                    {intl.formatMessage({ id: 'auth.login.remember_label', defaultMessage: 'Keep me signed in' })}
                  </span>
                </Checkbox.Content>
              </Checkbox>
            )}
          </form.Field>
        </div>

        {/* Action + error */}
        <div className="flex items-center justify-center gap-3">
          {submitError ? (
            <p className="text-[0.8125rem] leading-tight text-danger/80">{submitError}</p>
          ) : null}
          <Button type="submit" variant="primary" isPending={form.state.isSubmitting}>
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
      </div>
      </Form>
    </div>
  );
}

function LoginPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const { loginAs } = useAuthActions();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Demo list drives the card selector. The server returns [] when
  // DEMO_LOGIN_ENABLED != "true", so an empty list simply means demo OFF.
  // Vanilla tRPC (no createTRPCReact) per client conventions.
  const demoQuery = useQuery({
    queryKey: ['auth', 'demoUsers'],
    queryFn: () => trpcClient.auth.demoUsers.query(),
    enabled: !isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const demoUsersList = demoQuery.data ?? [];
  const demoLoading = demoQuery.isPending && !isAuthenticated;
  const demoEnabled = !demoQuery.isError && demoUsersList.length > 0;

  // Preselect the first demo user so "Login as X" is actionable immediately;
  // clicking any card replaces the selection (no auto sign-in on select).
  useEffect(() => {
    if (demoEnabled && selectedUserId === null && demoUsersList.length > 0) {
      const firstId = demoUsersList[0]?.id;
      if (firstId) setSelectedUserId(firstId);
    }
    if (!demoEnabled && selectedUserId !== null && demoUsersList.length === 0 && !demoLoading) {
      setSelectedUserId(null);
    }
  }, [demoEnabled, demoUsersList, selectedUserId, demoLoading]);

  const handleSelect = (userId: string) => {
    setSelectedUserId(userId);
    setDemoError(null);
  };

  const handleDemoLogin = async (userId: string) => {
    // Never fire passwordless login when the list is empty (demo OFF).
    // Selecting and logging in are one gesture: mark the card selected,
    // then run the same passwordless demoLogin session flow as before.
    const target = demoUsersList.find((user) => user.id === userId) ?? null;
    if (!target || pendingUserId !== null || demoUsersList.length === 0) return;
    setSelectedUserId(target.id);
    setDemoError(null);
    setPendingUserId(target.id);

    try {
      // Passwordless demoLogin; session atoms are applied inside loginAs
      // with the exact same applySession mapping the password form uses.
      await loginAs({ userId: target.id });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setDemoError(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: 'login.selectUser.error',
              defaultMessage: 'Demo sign-in failed',
            }),
      );
    } finally {
      setPendingUserId(null);
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const showDemo = demoLoading || demoEnabled;

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

      {/* ── Right: demo selector / sign-in ── */}
      <div className="flex flex-col justify-center gap-8 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(248,250,252,0.5))] p-8 dark:bg-[linear-gradient(180deg,rgba(18,24,38,0.45),rgba(17,24,39,0.32))] md:p-12">
        <div className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/75 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted backdrop-blur-sm">
            <Icon icon="solar:shield-check-linear" className="size-3.5 text-accent" />
            {intl.formatMessage({ id: 'auth.login.security_badge', defaultMessage: 'Secure workspace' })}
          </div>
          {showDemo ? (
            <div className="space-y-1.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-muted">
                {intl.formatMessage({
                  id: 'login.selectUser.badge',
                  defaultMessage: 'Instant demo access',
                })}
              </p>
              <h2 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
                {intl.formatMessage({
                  id: 'login.selectUser.heading',
                  defaultMessage: 'Select demo user to continue',
                })}
              </h2>
              <p className="text-[0.9375rem] leading-6 text-muted">
                {intl.formatMessage({
                  id: 'login.selectUser.hint',
                  defaultMessage: 'Pick a card, then continue — the password form stays available below.',
                })}
              </p>
            </div>
          ) : (
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
          )}
        </div>

        {showDemo ? (
          <>
            <DemoSelector
              users={demoUsersList}
              loading={demoLoading}
              selectedId={selectedUserId}
              pendingId={pendingUserId}
              error={demoError}
              onSelect={handleSelect}
              onLogin={(userId) => void handleDemoLogin(userId)}
            />

            <Disclosure isExpanded={passwordOpen} onExpandedChange={setPasswordOpen}>
              <Disclosure.Heading>
                <Button slot="trigger" variant="secondary" fullWidth>
                  <Icon icon="solar:lock-password-linear" className="size-4" />
                  {intl.formatMessage({
                    id: 'login.selectUser.usePassword',
                    defaultMessage: 'Or continue with email & password',
                  })}
                  <Disclosure.Indicator />
                </Button>
              </Disclosure.Heading>
              <Disclosure.Content>
                <Disclosure.Body className="px-0 pt-3 pb-0">
                  <CredentialsForm />
                </Disclosure.Body>
              </Disclosure.Content>
            </Disclosure>
          </>
        ) : (
          <CredentialsForm />
        )}

        <div className="flex items-center justify-center gap-2 border-t border-border/40 pt-5 text-[0.6875rem] text-muted">
          <Icon icon="solar:shield-check-linear" className="size-3.5" />
          {intl.formatMessage({ id: 'auth.login.footer_secure', defaultMessage: 'Session is protected and permission-aware.' })}
        </div>
      </div>
    </div>
  );
}

export { LoginPage };
