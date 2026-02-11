import { useState } from 'react';
import { Input, Button, Card, CardBody } from '@heroui/react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useTRPCClient } from '../trpc';
import { useAuth } from '../auth/AuthContext';

const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const trpcClient = useTRPCClient();
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      return trpcClient.auth.login.mutate(values);
    },
    onSuccess: (data) => {
      auth.setAuthData(data.token, data.user);
      navigate({ to: '/' });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Login failed. Please try again.';
      setError(errorMessage);
    },
  });

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(null);
      loginMutation.mutate(value);
    },
  });

  return (
    <div className='flex items-center justify-center min-h-screen bg-linear-to-br from-gray-50 to-gray-100'>
      <div className='w-full max-w-md px-4'>
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold text-gray-900 mb-2'>
            ERP Warehouse
          </h1>
          <h2 className='text-xl text-gray-600'>Sign In</h2>
        </div>

        {error && (
          <div className='mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800'>
            {error}
          </div>
        )}

        <Card className='shadow-lg'>
          <CardBody className='p-6'>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className='space-y-4'>
              <form.Field
                name='email'
                validators={{
                  onChange: ({ value }) =>
                    !value.includes('@') ? 'Invalid email address' : undefined,
                }}>
                {(field) => (
                  <Input
                    type='email'
                    label='Email'
                    placeholder='your@example.com'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors[0]}
                    isDisabled={loginMutation.isPending}
                    isRequired
                    variant='bordered'
                  />
                )}
              </form.Field>

              <form.Field
                name='password'
                validators={{
                  onChange: ({ value }) =>
                    value.length === 0 ? 'Password is required' : undefined,
                }}>
                {(field) => (
                  <Input
                    type='password'
                    label='Password'
                    placeholder='Your password'
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    isInvalid={field.state.meta.errors.length > 0}
                    errorMessage={field.state.meta.errors[0]}
                    isDisabled={loginMutation.isPending}
                    isRequired
                    variant='bordered'
                  />
                )}
              </form.Field>

              <Button
                type='submit'
                color='primary'
                className='w-full'
                size='lg'
                isLoading={loginMutation.isPending}>
                Sign In
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className='text-sm text-gray-500 text-center mt-6'>
          Contact your administrator for login credentials
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
