import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { Card } from '@heroui/react';
import { useAuthActions } from '../lib/useAuth';
import { useAtomValue } from 'jotai';
import { isAuthenticatedAtom } from '../lib/atoms';

export default function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const { login } = useAuthActions();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    <Card className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ERP Login</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Sign in to access your dashboard
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => (!value ? 'Email is required' : undefined),
          }}
          children={(field) => (
            <div className="space-y-1">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                className="form-input"
                autoComplete="email"
              />
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        />

        <form.Field
          name="password"
          validators={{
            onChange: ({ value }) => (!value ? 'Password is required' : undefined),
          }}
          children={(field) => (
            <div className="space-y-1">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                className="form-input"
                autoComplete="current-password"
              />
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-red-600 dark:text-red-400">{field.state.meta.errors[0]}</p>
              ) : null}
            </div>
          )}
        />

        {submitError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={form.state.isSubmitting}
        >
          {form.state.isSubmitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </Card>
  );
}
