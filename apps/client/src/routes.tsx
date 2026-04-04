import { createBrowserRouter, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import PrivateLayout from './layouts/PrivateLayout';
import PublicLayout from './layouts/PublicLayout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import RouteErrorPage from './pages/RouteErrorPage';
import ActivityLogDetailPage from './pages/activity-logs/ActivityLogDetailPage';
import ActivityLogsIndexPage from './pages/activity-logs/ActivityLogsIndexPage';
import RoleFormPage from './pages/access-control/RoleFormPage';
import RolesIndexPage from './pages/access-control/RolesIndexPage';
import UserDetailPage from './pages/users/UserDetailPage';
import UserFormPage from './pages/users/UserFormPage';
import UsersIndexPage from './pages/users/UsersIndexPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <PrivateLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'users',
        children: [
          {
            index: true,
            element: <UsersIndexPage />,
          },
          {
            path: 'new',
            element: <UserFormPage />,
          },
          {
            path: ':id',
            element: <UserDetailPage />,
          },
          {
            path: ':id/edit',
            element: <UserFormPage />,
          },
        ],
      },
      {
        path: 'access-control',
        children: [
          {
            path: 'roles',
            children: [
              {
                index: true,
                element: <RolesIndexPage />,
              },
              {
                path: 'new',
                element: <RoleFormPage />,
              },
              {
                path: ':id/edit',
                element: <RoleFormPage />,
              },
            ],
          },
        ],
      },
      {
        path: 'activity-logs',
        children: [
          {
            index: true,
            element: <ActivityLogsIndexPage />,
          },
          {
            path: ':id',
            element: <ActivityLogDetailPage />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: '/login',
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },
]);