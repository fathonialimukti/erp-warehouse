import type { LoginCredentials } from '@/types/model';

import React from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Checkbox,
  Separator,
  Link as HeroLink,
} from '@heroui/react';
import { Icon } from '@iconify/react';

import { useAuth } from '@/contexts/auth-context';

const LoginPage = () => {
  const { login, isLoginLoading } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = React.useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    } as LoginCredentials,
    onSubmit: async ({ value }) => {
      try {
        await login(value);
        navigate('/');
      } catch (error) {
        console.error('Login failed:', error);
      }
    },
  });

  return (
    <div className='flex h-full w-full items-center justify-center min-h-screen'>
      <div className='rounded-large bg-content1 shadow-small flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-large font-medium'>Masuk ke Akun</h1>
          <p className='text-small text-default-500'>
            Masukkan kredensial Anda untuk melanjutkan
          </p>
        </div>

        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}>
          <form.Field
            children={(field) => (
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
                variant='bordered'
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
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
              <Input
                disabled={isLoginLoading}
                endContent={
                  <button type='button' onClick={toggleVisibility}>
                    {isVisible ? (
                      <Icon
                        className='text-default-400 pointer-events-none text-2xl'
                        icon='solar:eye-closed-linear'
                      />
                    ) : (
                      <Icon
                        className='text-default-400 pointer-events-none text-2xl'
                        icon='solar:eye-bold'
                      />
                    )}
                  </button>
                }
                errorMessage={field.state.meta.errors.join(', ')}
                id={field.name}
                isInvalid={field.state.meta.errors.length > 0}
                label='Password'
                name={field.name}
                placeholder='Masukkan password Anda'
                type={isVisible ? 'text' : 'password'}
                value={field.state.value}
                variant='bordered'
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
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
              <div className='flex w-full items-center justify-between px-1 py-2'>
                <Checkbox
                  id={field.name}
                  isDisabled={isLoginLoading}
                  isSelected={field.state.value}
                  name={field.name}
                  size='sm'
                  onValueChange={(checked) => field.handleChange(checked)}>
                  Ingat saya
                </Checkbox>
                <HeroLink className='text-default-500' href='#' size='sm'>
                  Lupa password?
                </HeroLink>
              </div>
            )}
            name='remember'
          />

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                className='w-full'
                color='primary'
                disabled={!canSubmit || isLoginLoading}
                isLoading={isSubmitting || isLoginLoading}
                type='submit'>
                {isLoginLoading ? 'Sedang Masuk...' : 'Masuk'}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <div className='flex items-center gap-4 py-2'>
          <Separator className='flex-1' />
          <p className='text-tiny text-default-500 shrink-0'>ATAU</p>
          <Separator className='flex-1' />
        </div>

        <div className='flex flex-col gap-2'>
          <Button
            startContent={<Icon icon='flat-color-icons:google' width={24} />}
            variant='bordered'>
            Lanjutkan dengan Google
          </Button>
          <Button
            startContent={
              <Icon className='text-default-500' icon='fe:github' width={24} />
            }
            variant='bordered'>
            Lanjutkan dengan Github
          </Button>
        </div>

        <p className='text-small text-center'>
          Belum punya akun?&nbsp;
          <Link to='/register'>
            <HeroLink size='sm'>Daftar di sini</HeroLink>
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
