import { useState } from 'react';
import {
  TextInput,
  PasswordInput,
  Button,
  Container,
  Paper,
  Title,
  Text,
  Alert,
  Center,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useTRPCClient } from '../trpc';
import { useAuth } from './AuthContext';

export const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const trpcClient = useTRPCClient();

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (value.includes('@') ? null : 'Invalid email'),
      password: (value) => (value.length > 0 ? null : 'Password is required'),
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: { email: string; password: string }) => {
      return trpcClient.auth.login.mutate(values);
    },
    onSuccess: (data) => {
      auth.setAuthData(data.token, data.user);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Login failed. Please try again.';
      setError(errorMessage);
    },
  });

  const handleSubmit = (values: { email: string; password: string }) => {
    setError(null);
    loginMutation.mutate(values);
  };

  return (
    <Center style={{ height: '100vh' }}>
      <Container size={420} my={40}>
        <Stack>
          <Title order={2} ta='center' fw={900}>
            ERP Warehouse
          </Title>
          <Title order={3} ta='center' c='gray' size='h4'>
            Sign In
          </Title>
        </Stack>

        {error && (
          <Alert color='red' mt={20}>
            {error}
          </Alert>
        )}

        <Paper p={30} radius='md' withBorder mt={20}>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <TextInput
              label='Email'
              placeholder='your@example.com'
              required
              {...form.getInputProps('email')}
              disabled={loginMutation.isPending}
            />

            <PasswordInput
              label='Password'
              placeholder='Your password'
              required
              mt='md'
              {...form.getInputProps('password')}
              disabled={loginMutation.isPending}
            />

            <Button
              fullWidth
              mt='xl'
              size='md'
              type='submit'
              loading={loginMutation.isPending}>
              Sign In
            </Button>
          </form>
        </Paper>

        <Text c='dimmed' size='sm' ta='center' mt={20}>
          Contact your administrator for login credentials
        </Text>
      </Container>
    </Center>
  );
};
