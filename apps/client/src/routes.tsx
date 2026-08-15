import { createBrowserRouter } from 'react-router';
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
import { SkuIndexPage } from './pages/sku/SkuIndexPage';
import { SupplierIndexPage } from './pages/suppliers/SupplierIndexPage';
import { SupplierFormPage } from './pages/suppliers/SupplierFormPage';
import { SupplierDetailPage } from './pages/suppliers/SupplierDetailPage';
import { ProductIndexPage } from './pages/products/ProductIndexPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
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
import { MonthlyStockMovementPage } from './pages/reports/MonthlyStockMovementPage';
import { SkuStockMovementDetailPage } from './pages/reports/SkuStockMovementDetailPage';
import { InventoryBalancePage } from './pages/reports/InventoryBalancePage';
import { ReportsDashboardPage } from './pages/reports/ReportsDashboardPage';
import { SubinventoryTransferDetailPage } from './pages/subinventory-transfer/SubinventoryTransferDetailPage';
import { SubinventoryTransferFormPage } from './pages/subinventory-transfer/SubinventoryTransferFormPage';
import { SubinventoryTransferIndexPage } from './pages/subinventory-transfer';
import { PalletIndexPage } from './pages/pallets';
import { PalletDetailPage } from './pages/pallets/PalletDetailPage';
import { InventoryAgingPage } from './pages/inventory-aging/InventoryAgingPage';
import { LandingPage } from './pages/LandingPage';
import AiAdminPage from './pages/ai-admin/AiAdminPage';
import AiAnalyticsPage from './pages/ai-analytics/AiAnalyticsPage';
import { KnowledgeIndexPage } from './pages/knowledge/KnowledgeIndexPage';
import { KnowledgeDetailPage } from './pages/knowledge/KnowledgeDetailPage';
import { KnowledgeFormPage } from './pages/knowledge/KnowledgeFormPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <RouteErrorPage />,
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
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <PrivateLayout />
      </ProtectedRoute>
    ),
    children: [
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
            path: ':id',
            element: <SkuDetailPage />,
          },
        ],
      },
      {
        path: 'suppliers',
        children: [
          {
            index: true,
            element: <SupplierIndexPage />,
          },
          {
            path: 'new',
            element: <SupplierFormPage />,
          },
          {
            path: ':id',
            element: <SupplierDetailPage />,
          },
          {
            path: ':id/edit',
            element: <SupplierFormPage />,
          },
        ],
      },
      {
        path: 'products',
        children: [
          {
            index: true,
            element: <ProductIndexPage />,
          },
          {
            path: 'new',
            element: <ProductFormPage />,
          },
          {
            path: ':id',
            element: <ProductDetailPage />,
          },
          {
            path: ':id/edit',
            element: <ProductFormPage />,
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
        path: 'subinventory-transfer',
        children: [
          {
            index: true,
            element: <SubinventoryTransferIndexPage />,
          },
          {
            path: 'new',
            element: <SubinventoryTransferFormPage />,
          },
          {
            path: ':id',
            element: <SubinventoryTransferDetailPage />,
          },
          {
            path: ':id/edit',
            element: <SubinventoryTransferFormPage />,
          },
        ],
      },
      {
        path: 'pallets',
        children: [
          {
            index: true,
            element: <PalletIndexPage />,
          },
          {
            path: ':id',
            element: <PalletDetailPage />,
          },
        ],
      },
      {
        path: 'reports',
        children: [
          {
            path: 'monthly-stock-movement',
            element: <MonthlyStockMovementPage />,
          },
          {
            path: 'monthly-stock-movement/:skuId',
            element: <SkuStockMovementDetailPage />,
          },
          {
            path: 'inventory-balance',
            element: <InventoryBalancePage />,
          },
          {
            path: 'charts',
            element: <ReportsDashboardPage />,
          },
        ],
      },
      {
        path: 'inventory-aging',
        element: <InventoryAgingPage />,
      },
      {
        path: 'knowledge',
        children: [
          {
            index: true,
            element: <KnowledgeIndexPage />,
          },
          {
            path: 'new',
            element: <KnowledgeFormPage />,
          },
          {
            path: ':id',
            element: <KnowledgeDetailPage />,
          },
          {
            path: ':id/edit',
            element: <KnowledgeFormPage />,
          },
        ],
      },
      {
        path: 'ai-admin',
        element: <AiAdminPage />,
      },
      {
        path: 'ai-analytics',
        element: <AiAnalyticsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);