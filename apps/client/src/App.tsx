import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TextInput,
  Button,
  Container,
  Title,
  Group,
  Card,
  Text,
  Stack,
  Loader,
  Alert,
} from '@mantine/core';
import { useTRPC } from './trpc';

function App() {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query to get greeting
  const greetingQuery = useQuery(
    trpc.greeting.queryOptions({
      name: displayName || undefined,
    }),
  );

  // Mutation to create a greeting
  const createGreetingMutation = useMutation(
    trpc.createGreeting.mutationOptions({
      onSuccess: (data) => {
        console.log('Greeting created:', data);
        // Invalidate the greeting query to refresh with new data
        void queryClient.invalidateQueries({
          queryKey: trpc.greeting.queryKey({ name: data.name }),
        });
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      void createGreetingMutation.mutate({ name });
      setDisplayName(name);
    }
  };

  return (
    <Container size='md' py='xl'>
      <Stack gap='xl'>
        <Title order={1} ta='center'>
          Welcome to Tauri + React + tRPC + Mantine
        </Title>

        <Text ta='center' c='dimmed'>
          tRPC 11 with TanStack React Query and Mantine UI Integration
        </Text>

        <Card withBorder shadow='sm' p='lg'>
          <form onSubmit={handleSubmit}>
            <Group gap='md'>
              <TextInput
                placeholder='Enter a name...'
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                style={{ flex: 1 }}
                size='md'
              />
              <Button
                type='submit'
                loading={createGreetingMutation.isPending}
                size='md'>
                {createGreetingMutation.isPending ? 'Creating...' : 'Greet'}
              </Button>
            </Group>
          </form>
        </Card>

        {greetingQuery.isLoading && (
          <Group justify='center'>
            <Loader size='md' />
            <Text>Loading greeting...</Text>
          </Group>
        )}

        {greetingQuery.error && (
          <Alert color='red' title='Error'>
            {greetingQuery.error.message}
          </Alert>
        )}

        {greetingQuery.data && (
          <Card withBorder shadow='sm' p='lg'>
            <Title order={3} mb='md'>
              Greeting Result
            </Title>
            <Text size='lg' fw={500}>
              {greetingQuery.data.greeting}
            </Text>
          </Card>
        )}

        {createGreetingMutation.data && (
          <Card withBorder shadow='sm' p='lg'>
            <Title order={3} mb='md'>
              Last Created Greeting
            </Title>
            <Stack gap='xs'>
              <Text>
                <strong>ID:</strong> {createGreetingMutation.data.id}
              </Text>
              <Text>
                <strong>Name:</strong> {createGreetingMutation.data.name}
              </Text>
              <Text>
                <strong>Message:</strong> {createGreetingMutation.data.greeting}
              </Text>
              <Text>
                <strong>Created:</strong>{' '}
                {new Date(
                  createGreetingMutation.data.createdAt,
                ).toLocaleString()}
              </Text>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

export default App;
