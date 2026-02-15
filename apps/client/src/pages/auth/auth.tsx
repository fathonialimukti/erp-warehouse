import type { LoginCredentials, RegisterCredentials } from '@/types/model';

import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@heroui/react';

import { useAuth } from '@/contexts/auth-context';

const AuthPage = () => {
  const { login, register, isLoginLoading, isRegisterLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const loginForm = useForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    } as LoginCredentials,
    onSubmit: async ({ value }) => {
      try {
        await login(value);
        navigate('/dashboard');
      } catch (error) {
        console.error('Login failed:', error);
      }
    },
  });

  const registerForm = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    } as RegisterCredentials,
    onSubmit: async ({ value }) => {
      try {
        await register(value);
        navigate('/dashboard');
      } catch (error) {
        console.error('Registration failed:', error);
      }
    },
  });

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <Card className='w-full max-w-md'>
        <div className='card__header text-center'>
          <h2 className='text-3xl font-bold text-gray-900'>Manajer Bisnis</h2>
          <p className='mt-2 text-sm text-gray-600'>
            Sistem manajemen bisnis komprehensif
          </p>
        </div>
        <div className='card__content'>
          <div className='flex mb-6'>
            <Button
              className='flex-1'
              variant={activeTab === 'login' ? 'solid' : 'light'}
              onPress={() => setActiveTab('login')}>
              Masuk
            </Button>
            <Button
              className='flex-1'
              variant={activeTab === 'register' ? 'solid' : 'light'}
              onPress={() => setActiveTab('register')}>
              Daftar
            </Button>
          </div>

          {activeTab === 'login' ? (
            <form
              className='space-y-6'
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                loginForm.handleSubmit();
              }}>
              <loginForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isLoginLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Email'
                      name={field.name}
                      placeholder='Masukkan email Anda'
                      type='email'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='email'
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? 'Email wajib diisi'
                      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                        ? 'Format email tidak valid'
                        : undefined,
                }}
              />

              <loginForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isLoginLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Password'
                      name={field.name}
                      placeholder='Masukkan password Anda'
                      type='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='password'
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? 'Password wajib diisi'
                      : value.length < 8
                        ? 'Password minimal 8 karakter'
                        : undefined,
                }}
              />

              <loginForm.Field
                children={(field) => (
                  <div className='flex items-center'>
                    <input
                      checked={field.state.value}
                      className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      disabled={isLoginLoading}
                      id={field.name}
                      name={field.name}
                      type='checkbox'
                      onChange={(e) => field.handleChange(e.target.checked)}
                    />
                    <label
                      className='ml-2 block text-sm text-gray-900'
                      htmlFor={field.name}>
                      Ingat saya
                    </label>
                  </div>
                )}
                name='remember'
              />

              <loginForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className='w-full'
                    disabled={!canSubmit || isLoginLoading}
                    isLoading={isSubmitting || isLoginLoading}
                    type='submit'>
                    {isLoginLoading ? 'Sedang Masuk...' : 'Masuk'}
                  </Button>
                )}
              </loginForm.Subscribe>
            </form>
          ) : (
            <form
              className='space-y-6'
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                registerForm.handleSubmit();
              }}>
              <registerForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isRegisterLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Nama Lengkap'
                      name={field.name}
                      placeholder='Masukkan nama lengkap Anda'
                      type='text'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='name'
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? 'Nama wajib diisi'
                      : value.length < 2
                        ? 'Nama minimal 2 karakter'
                        : undefined,
                }}
              />

              <registerForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isRegisterLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Email'
                      name={field.name}
                      placeholder='Masukkan email Anda'
                      type='email'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='email'
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? 'Email wajib diisi'
                      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                        ? 'Format email tidak valid'
                        : undefined,
                }}
              />

              <registerForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isRegisterLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Password'
                      name={field.name}
                      placeholder='Masukkan password Anda'
                      type='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='password'
                validators={{
                  onChange: ({ value }) =>
                    !value
                      ? 'Password wajib diisi'
                      : value.length < 8
                        ? 'Password minimal 8 karakter'
                        : undefined,
                }}
              />

              <registerForm.Field
                children={(field) => (
                  <div>
                    <Input
                      disabled={isRegisterLoading}
                      errorMessage={field.state.meta.errors.join(', ')}
                      id={field.name}
                      isInvalid={field.state.meta.errors.length > 0}
                      label='Konfirmasi Password'
                      name={field.name}
                      placeholder='Masukkan ulang password Anda'
                      type='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                name='password_confirmation'
                validators={{
                  onChange: ({ value, fieldApi }) => {
                    const password = fieldApi.form.getFieldValue('password');

                    return !value
                      ? 'Konfirmasi password wajib diisi'
                      : value !== password
                        ? 'Password tidak cocok'
                        : undefined;
                  },
                }}
              />

              <registerForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    className='w-full'
                    disabled={!canSubmit || isRegisterLoading}
                    isLoading={isSubmitting || isRegisterLoading}
                    type='submit'>
                    {isRegisterLoading ? 'Sedang Mendaftar...' : 'Daftar'}
                  </Button>
                )}
              </registerForm.Subscribe>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AuthPage;
