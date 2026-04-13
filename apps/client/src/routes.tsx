import { createBrowserRouter, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import PrivateLayout from './layouts/PrivateLayout';
import PublicLayout from './layouts/PublicLayout';
import Dashboard from './pages/Dashboard';
import GlbViewerPage from './pages/GlbViewerPage';
import WarehouseLayoutPage from './pages/WarehouseLayoutPage';
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
import TransactionsIndexPage from './pages/transactions';
import LostTransactionDetailPage from './pages/transactions/loss/detail';
import LostTransactionFormPage from './pages/transactions/loss/form';
import OutboundTransactionDetailPage from './pages/transactions/outbound/detail';
import OutboundTransactionFormPage from './pages/transactions/outbound/form';
import InboundTransactionDetailPage from './pages/transactions/inbound/detail';
import InboundTransactionFormPage from './pages/transactions/inbound/form';
import FoundTransactionDetailPage from './pages/transactions/found/detail';
import FoundTransactionFormPage from './pages/transactions/found/form';
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
        path: 'glb-viewer',
        element: <GlbViewerPage />,
      },
      {
        path: 'warehouse-layout-3d',
        element: <WarehouseLayoutPage />,
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
        path: 'transactions',
        children: [
          {
            index: true,
            element: <TransactionsIndexPage />,
          },
          {
            path: 'inbound',
            children: [
              {
                path: 'form',
                element: <InboundTransactionFormPage />,
              },
              {
                path: 'form/:id',
                element: <InboundTransactionFormPage />,
              },
              {
                path: 'detail/:id',
                element: <InboundTransactionDetailPage />,
              },
            ],
          },
          {
            path: 'outbound',
            children: [
              {
                path: 'form',
                element: <OutboundTransactionFormPage />,
              },
              {
                path: 'form/:id',
                element: <OutboundTransactionFormPage />,
              },
              {
                path: 'detail/:id',
                element: <OutboundTransactionDetailPage />,
              },
            ],
          },
          {
            path: 'found',
            children: [
              {
                path: 'form',
                element: <FoundTransactionFormPage />,
              },
              {
                path: 'form/:id',
                element: <FoundTransactionFormPage />,
              },
              {
                path: 'detail/:id',
                element: <FoundTransactionDetailPage />,
              },
            ],
          },
          {
            path: 'loss',
            children: [
              {
                path: 'form',
                element: <LostTransactionFormPage />,
              },
              {
                path: 'form/:id',
                element: <LostTransactionFormPage />,
              },
              {
                path: 'detail/:id',
                element: <LostTransactionDetailPage />,
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