import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import {
  Container,
  Button,
  Group,
  Text,
  Stack,
  Title,
  Avatar,
} from '@mantine/core';

function App() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Container size='md' py={40}>
      <Group justify='space-between' mb={40}>
        <Title order={1}>Dashboard</Title>
        <Button onClick={logout} variant='light'>
          Sign Out
        </Button>
      </Group>

      {user && (
        <Stack>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <Avatar name={user.name || user.email} size='lg' />
            <div>
              <Text fw={500}>{user.name || 'User'}</Text>
              <Text size='sm' c='dimmed'>
                {user.email}
              </Text>
            </div>
          </div>

          {user.roles.length > 0 && (
            <div>
              <Title order={4} mb={10}>
                Roles & Permissions
              </Title>
              <Stack gap='xs'>
                {user.roles.map((role) => (
                  <div key={role.id}>
                    <Text fw={500}>{role.name}</Text>
                    <Text size='sm' c='dimmed'>
                      {role.permissions.join(', ')}
                    </Text>
                  </div>
                ))}
              </Stack>
            </div>
          )}
        </Stack>
      )}
    </Container>
  );
}

export default App;
