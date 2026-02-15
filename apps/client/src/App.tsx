import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/trpc';
import { AuthProvider } from './contexts/auth-context';

// Pages
import DashboardPage from './pages/dashboard';
import CustomerPage from './pages/customer';
import CustomerFormPage from './pages/customer/form-page';
import CustomerDetailPage from './pages/customer/detail';
import DepartemenPage from './pages/departemen';
import DepartemenFormPage from './pages/departemen/form-page';
import DepartemenDetailPage from './pages/departemen/detail';
import AuthPage from './pages/auth/auth';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import NotFoundPage from './pages/error/not-found';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Routes>
        <Route path='/' element={<Navigate to='/dashboard' replace />} />
        <Route path='/dashboard' element={<DashboardPage />} />

        <Route path='/customer' element={<CustomerPage />} />
        <Route path='/customer/create' element={<CustomerFormPage />} />
        <Route path='/customer/:id/edit' element={<CustomerFormPage />} />
        <Route path='/customer/:id/detail' element={<CustomerDetailPage />} />

        <Route path='/departemen' element={<DepartemenPage />} />
        <Route path='/departemen/create' element={<DepartemenFormPage />} />
        <Route path='/departemen/:id/edit' element={<DepartemenFormPage />} />
        <Route
          path='/departemen/:id/detail'
          element={<DepartemenDetailPage />}
        />

        <Route path='/login' element={<LoginPage />} />
        <Route path='/register' element={<RegisterPage />} />
        <Route path='/auth' element={<AuthPage />} />

        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
