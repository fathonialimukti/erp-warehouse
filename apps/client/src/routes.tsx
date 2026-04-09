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
import SkuDetailPage from './pages/sku/SkuDetailPage';
import SkuFormPage from './pages/sku/SkuFormPage';
import SkuIndexPage from './pages/sku/SkuIndexPage';
import TransaksiIndexPage from './pages/transaksi';
import TransaksiKehilanganDetailPage from './pages/transaksi/kehilangan/detail';
import TransaksiKehilanganFormPage from './pages/transaksi/kehilangan/form';
import TransaksiKehilanganIndexPage from './pages/transaksi/kehilangan';
import TransaksiKeluarDetailPage from './pages/transaksi/keluar/detail';
import TransaksiKeluarFormPage from './pages/transaksi/keluar/form';
import TransaksiKeluarIndexPage from './pages/transaksi/keluar';
import TransaksiMasukDetailPage from './pages/transaksi/masuk/detail';
import TransaksiMasukFormPage from './pages/transaksi/masuk/form';
import TransaksiMasukIndexPage from './pages/transaksi/masuk';
import TransaksiTemuanDetailPage from './pages/transaksi/temuan/detail';
import TransaksiTemuanFormPage from './pages/transaksi/temuan/form';
import TransaksiTemuanIndexPage from './pages/transaksi/temuan';
import WarehouseDetailPage from './pages/warehouse/WarehouseDetailPage';
import WarehouseFormPage from './pages/warehouse/WarehouseFormPage';
import WarehouseIndexPage from './pages/warehouse/WarehouseIndexPage';

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
        path: 'warehouse',
        children: [
          {
            index: true,
            element: <WarehouseIndexPage />,
          },
          {
            path: 'new',
            element: <WarehouseFormPage />,
          },
          {
            path: ':id',
            element: <WarehouseDetailPage />,
          },
          {
            path: ':id/edit',
            element: <WarehouseFormPage />,
          },
        ],
      },
      {
        path: 'skus',
        children: [
          {
            index: true,
            element: <SkuIndexPage />,
          },
          {
            path: 'new',
            element: <SkuFormPage />,
          },
          {
            path: ':id',
            element: <SkuDetailPage />,
          },
          {
            path: ':id/edit',
            element: <SkuFormPage />,
          },
        ],
      },
      {
        path: 'transaksi',
        children: [
          {
            index: true,
            element: <TransaksiIndexPage />,
          },
          {
            path: 'masuk',
            children: [
              {
                index: true,
                element: <TransaksiMasukIndexPage />,
              },
              {
                path: 'form',
                element: <TransaksiMasukFormPage />,
              },
              {
                path: 'form/:id',
                element: <TransaksiMasukFormPage />,
              },
              {
                path: 'detail/:id',
                element: <TransaksiMasukDetailPage />,
              },
            ],
          },
          {
            path: 'keluar',
            children: [
              {
                index: true,
                element: <TransaksiKeluarIndexPage />,
              },
              {
                path: 'form',
                element: <TransaksiKeluarFormPage />,
              },
              {
                path: 'form/:id',
                element: <TransaksiKeluarFormPage />,
              },
              {
                path: 'detail/:id',
                element: <TransaksiKeluarDetailPage />,
              },
            ],
          },
          {
            path: 'temuan',
            children: [
              {
                index: true,
                element: <TransaksiTemuanIndexPage />,
              },
              {
                path: 'form',
                element: <TransaksiTemuanFormPage />,
              },
              {
                path: 'form/:id',
                element: <TransaksiTemuanFormPage />,
              },
              {
                path: 'detail/:id',
                element: <TransaksiTemuanDetailPage />,
              },
            ],
          },
          {
            path: 'kehilangan',
            children: [
              {
                index: true,
                element: <TransaksiKehilanganIndexPage />,
              },
              {
                path: 'form',
                element: <TransaksiKehilanganFormPage />,
              },
              {
                path: 'form/:id',
                element: <TransaksiKehilanganFormPage />,
              },
              {
                path: 'detail/:id',
                element: <TransaksiKehilanganDetailPage />,
              },
            ],
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