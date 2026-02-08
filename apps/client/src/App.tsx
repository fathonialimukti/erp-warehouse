import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import reactLogo from './assets/react.svg';
import { useTRPC } from './trpc';
import './App.css';

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
    <main className='container'>
      <h1>Welcome to Tauri + React + tRPC</h1>

      <div className='row'>
        <a href='https://vite.dev' target='_blank'>
          <img src='/vite.svg' className='logo vite' alt='Vite logo' />
        </a>
        <a href='https://tauri.app' target='_blank'>
          <img src='/tauri.svg' className='logo tauri' alt='Tauri logo' />
        </a>
        <a href='https://react.dev' target='_blank'>
          <img src={reactLogo} className='logo react' alt='React logo' />
        </a>
      </div>
      <p>tRPC 11 with TanStack React Query Integration</p>

      <form className='row' onSubmit={handleSubmit}>
        <input
          id='greet-input'
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder='Enter a name...'
        />
        <button type='submit' disabled={createGreetingMutation.isPending}>
          {createGreetingMutation.isPending ? 'Creating...' : 'Greet'}
        </button>
      </form>

      {greetingQuery.isLoading && <p>Loading greeting...</p>}
      {greetingQuery.error && (
        <p style={{ color: 'red' }}>Error: {greetingQuery.error.message}</p>
      )}
      {greetingQuery.data && (
        <p style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
          {greetingQuery.data.greeting}
        </p>
      )}

      {createGreetingMutation.data && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#f0f0f0',
            borderRadius: '8px',
          }}>
          <p>
            <strong>Last Created Greeting:</strong>
          </p>
          <p>ID: {createGreetingMutation.data.id}</p>
          <p>Name: {createGreetingMutation.data.name}</p>
          <p>Message: {createGreetingMutation.data.greeting}</p>
          <p>
            Created:{' '}
            {new Date(createGreetingMutation.data.createdAt).toLocaleString()}
          </p>
        </div>
      )}
    </main>
  );
}

export default App;
