import { useAuth } from './auth/AuthContext';
import LoginPage from './login';
import { Spinner } from '@/components/ui/spinner';

function App() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className='container mx-auto max-w-4xl py-10 px-4'>
     
    </div>
  );
}

export default App;
