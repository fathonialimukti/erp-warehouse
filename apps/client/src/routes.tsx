import { createBrowserRouter, Navigate } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PrivateLayout } from './layouts/PrivateLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { Dashboard } from './pages/Dashboard';
import { WarehouseLayoutPage } from './pages/warehouse/warehouse-layout-3d/WarehouseLayoutPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import { ActivityLogDetailPage } from './pages/activity-logs/ActivityLogDetailPage';
import { ActivityLogsIndexPage } from './pages/activity-logs/ActivityLogsIndexPage';
import { RoleFormPage } from './pages/access-control/RoleFormPage';
import { RolesIndexPage } from './pages/access-control/RolesIndexPage';
import { UserDetailPage } from './pages/users/UserDetailPage';
import { UserFormPage } from './pages/users/UserFormPage';
import { UsersIndexPage } from './pages/users/UsersIndexPage';
import { SkuDetailPage } from './pages/sku/SkuDetailPage';
import { SkuFormPage } from './pages/sku/SkuFormPage';
import { SkuIndexPage } from './pages/sku/SkuIndexPage';
import { InboundTransactionIndexPage } from './pages/inbound-transaction';
import { ReceivingTransactionDetailPage } from './pages/inbound-transaction/receiving/ReceivingTransactionDetailPage';
import { ReceivingTransactionFormPage } from './pages/inbound-transaction/receiving/ReceivingTransactionFormPage';
import { FoundTransactionDetailPage } from './pages/inbound-transaction/found/FoundTransactionDetailPage';
import { FoundTransactionFormPage } from './pages/inbound-transaction/found/FoundTransactionFormPage';
import { RmaReceiptDetailPage } from './pages/inbound-transaction/rma-receipt/RmaReceiptDetailPage';
import { RmaReceiptFormPage } from './pages/inbound-transaction/rma-receipt/RmaReceiptFormPage';
import { WipCompletionDetailPage } from './pages/inbound-transaction/wip-completion/WipCompletionDetailPage';
import { WipCompletionFormPage } from './pages/inbound-transaction/wip-completion/WipCompletionFormPage';
import { OutboundTransactionIndexPage } from './pages/outbound-transaction';
import { ShipmentDetailPage } from './pages/outbound-transaction/shipment/ShipmentDetailPage';
import { ShipmentFormPage } from './pages/outbound-transaction/shipment/ShipmentFormPage';
import { DisposalDetailPage } from './pages/outbound-transaction/disposal/DisposalDetailPage';
import { DisposalFormPage } from './pages/outbound-transaction/disposal/DisposalFormPage';
import { LossTransactionDetailPage } from './pages/outbound-transaction/loss/LossTransactionDetailPage';
import { LossTransactionFormPage } from './pages/outbound-transaction/loss/LossTransactionFormPage';
import { ReturnToSupplierDetailPage } from './pages/outbound-transaction/return-to-supplier/ReturnToSupplierDetailPage';
import { ReturnToSupplierFormPage } from './pages/outbound-transaction/return-to-supplier/ReturnToSupplierFormPage';
import { WipIssueDetailPage } from './pages/outbound-transaction/wip-issue/WipIssueDetailPage';
import { WipIssueFormPage } from './pages/outbound-transaction/wip-issue/WipIssueFormPage';
import { WarehouseDetailPage } from './pages/warehouse/WarehouseDetailPage';
import { WarehouseFormPage } from './pages/warehouse/WarehouseFormPage';
import { WarehouseIndexPage } from './pages/warehouse/WarehouseIndexPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { StockMovementPage } from './pages/stock-movement/StockMovementPage';

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
          {
            path: ':id/layout',
            element: <WarehouseLayoutPage />,
          }
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
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'inbound-transaction',
        children: [
          {
            index: true,
            element: <InboundTransactionIndexPage />,
          },
          {
            path: 'receiving/new',
            element: <ReceivingTransactionFormPage />,
          },
          {
            path: 'receiving/:id',
            element: <ReceivingTransactionDetailPage />,
          },
          {
            path: 'receiving/:id/edit',
            element: <ReceivingTransactionFormPage />,
          },
          {
            path: 'found/new',
            element: <FoundTransactionFormPage />,
          },
          {
            path: 'found/:id',
            element: <FoundTransactionDetailPage />,
          },
          {
            path: 'found/:id/edit',
            element: <FoundTransactionFormPage />,
          },
          {
            path: 'rma-receipt/new',
            element: <RmaReceiptFormPage />,
          },
          {
            path: 'rma-receipt/:id',
            element: <RmaReceiptDetailPage />,
          },
          {
            path: 'rma-receipt/:id/edit',
            element: <RmaReceiptFormPage />,
          },
          {
            path: 'wip-completion/new',
            element: <WipCompletionFormPage />,
          },
          {
            path: 'wip-completion/:id',
            element: <WipCompletionDetailPage />,
          },
          {
            path: 'wip-completion/:id/edit',
            element: <WipCompletionFormPage />,
          },
        ],
      },
      {
        path: 'outbound-transaction',
        children: [
          {
            index: true,
            element: <OutboundTransactionIndexPage />,
          },
          {
            path: 'shipment/new',
            element: <ShipmentFormPage />,
          },
          {
            path: 'shipment/:id',
            element: <ShipmentDetailPage />,
          },
          {
            path: 'shipment/:id/edit',
            element: <ShipmentFormPage />,
          },
          {
            path: 'disposal/new',
            element: <DisposalFormPage />,
          },
          {
            path: 'disposal/:id',
            element: <DisposalDetailPage />,
          },
          {
            path: 'disposal/:id/edit',
            element: <DisposalFormPage />,
          },
          {
            path: 'loss/new',
            element: <LossTransactionFormPage />,
          },
          {
            path: 'loss/:id',
            element: <LossTransactionDetailPage />,
          },
          {
            path: 'loss/:id/edit',
            element: <LossTransactionFormPage />,
          },
          {
            path: 'return-to-supplier/new',
            element: <ReturnToSupplierFormPage />,
          },
          {
            path: 'return-to-supplier/:id',
            element: <ReturnToSupplierDetailPage />,
          },
          {
            path: 'return-to-supplier/:id/edit',
            element: <ReturnToSupplierFormPage />,
          },
          {
            path: 'wip-issue/new',
            element: <WipIssueFormPage />,
          },
          {
            path: 'wip-issue/:id',
            element: <WipIssueDetailPage />,
          },
          {
            path: 'wip-issue/:id/edit',
            element: <WipIssueFormPage />,
          },
        ],
      },
      {
        path: 'stock-movement',
        element: <StockMovementPage />,
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