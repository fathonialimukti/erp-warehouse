import { Navigate, createBrowserRouter } from 'react-router';
import PublicLayout from './layouts/PublicLayout';
import PrivateLayout from './layouts/PrivateLayout';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';
import RouteErrorPage from './pages/RouteErrorPage';
import UsersIndexPage from './pages/users/UsersIndexPage';
import UserFormPage from './pages/users/UserFormPage';
import UserDetailPage from './pages/users/UserDetailPage';
import RolesIndexPage from './pages/access-control/RolesIndexPage';
import RoleFormPage from './pages/access-control/RoleFormPage';

const userRoutes = [
  { path: 'users', element: <UsersIndexPage /> },
  { path: 'users/new', element: <UserFormPage /> },
  { path: 'users/:id', element: <UserDetailPage /> },
  { path: 'users/:id/edit', element: <UserFormPage /> },
];

const accessControlRoutes = [
  { path: 'access-control', element: <RolesIndexPage /> },
  { path: 'access-control/new', element: <RoleFormPage /> },
  { path: 'access-control/:id/edit', element: <RoleFormPage /> },
];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        lazy: async () => {
          const module = await import('./pages/LoginPage');
          return { Component: module.default };
        },
      },
    ],
  },
  {
    path: '/',
    errorElement: <RouteErrorPage />,
    element: (
      <ProtectedRoute>
        <PrivateLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        lazy: async () => {
          const module = await import('./pages/Dashboard');
          return { Component: module.default };
        },
      },
      ...userRoutes,
      ...accessControlRoutes,
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
