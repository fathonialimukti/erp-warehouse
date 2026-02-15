import type { RegisterCredentials } from '@/types/model';

import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '@heroui/react';

import { useAuth } from '@/contexts/auth-context';

const RegisterPage = () => {
  const { register, isRegisterLoading } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
    } as RegisterCredentials,
    onSubmit: async ({ value }) => {
      try {
        await register(value);
        navigate('/');
      } catch (error) {
        console.error('Registration failed:', error);
      }
    },
  });

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <Card className='w-full max-w-md'>
        <div className='card__header text-center'>
          <h2 className='text-3xl font-bold text-gray-900'>Buat Akun Baru</h2>
          <p className='mt-2 text-sm text-gray-600'>
            Daftar untuk mulai menggunakan sistem manajemen bisnis
          </p>
        </div>
        <div className='card__content'>
          <form
            className='space-y-6'
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}>
            <form.Field
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

            <form.Field
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

            <form.Field
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

            <form.Field
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

            <form.Subscribe
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
            </form.Subscribe>
          </form>

          <div className='mt-6 text-center'>
            <p className='text-sm text-gray-600'>
              Sudah punya akun?{' '}
              <Link
                className='font-medium text-blue-600 hover:text-blue-500'
                to='/login'>
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
