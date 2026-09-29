import { lazy, Suspense, type ReactElement } from "react";
import { createBrowserRouter } from "react-router";
import { Spinner } from "@heroui/react";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PrivateLayout } from "./layouts/PrivateLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

/**
 * Route-level code splitting.
 *
 * Only the auth shell (`PublicLayout` / `PrivateLayout`), the sign-in page and
 * the 404 / route-error screens stay in the entry chunk. Every other page is
 * fetched when its route first renders, which keeps three.js / R3F, recharts,
 * mermaid, jspdf and xlsx out of the first paint. Route paths, components and
 * behaviour are unchanged — only the fetch timing moved.
 */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <Spinner size="lg" />
    </div>
  );
}

/** Every routed page is prop-less — they read their params from the router. */
type PageComponent = () => ReactElement;

/** Wraps a lazily-imported page in its own Suspense boundary. */
function lazyPage(load: () => Promise<{ default: PageComponent }>) {
  const Page = lazy(load);
  return function LazyPage(): ReactElement {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Page />
      </Suspense>
    );
  };
}

// ── Landing ──
const LandingPage = lazyPage(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);

// ── Overview ──
const Dashboard = lazyPage(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const NotificationsPage = lazyPage(() =>
  import("./pages/notifications/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const StockMovementPage = lazyPage(() =>
  import("./pages/stock-movement/StockMovementPage").then((m) => ({
    default: m.StockMovementPage,
  })),
);
const InventoryAgingPage = lazyPage(() =>
  import("./pages/inventory-aging/InventoryAgingPage").then((m) => ({
    default: m.InventoryAgingPage,
  })),
);
const ReorderPage = lazyPage(() =>
  import("./pages/reorder/ReorderPage").then((m) => ({
    default: m.ReorderPage,
  })),
);

// ── Administration ──
const UsersIndexPage = lazyPage(() =>
  import("./pages/users/UsersIndexPage").then((m) => ({
    default: m.UsersIndexPage,
  })),
);
const UserDetailPage = lazyPage(() =>
  import("./pages/users/UserDetailPage").then((m) => ({
    default: m.UserDetailPage,
  })),
);
const UserFormPage = lazyPage(() =>
  import("./pages/users/UserFormPage").then((m) => ({
    default: m.UserFormPage,
  })),
);
const RolesIndexPage = lazyPage(() =>
  import("./pages/access-control/RolesIndexPage").then((m) => ({
    default: m.RolesIndexPage,
  })),
);
const RoleFormPage = lazyPage(() =>
  import("./pages/access-control/RoleFormPage").then((m) => ({
    default: m.RoleFormPage,
  })),
);
const ActivityLogsIndexPage = lazyPage(() =>
  import("./pages/activity-logs/ActivityLogsIndexPage").then((m) => ({
    default: m.ActivityLogsIndexPage,
  })),
);
const ActivityLogDetailPage = lazyPage(() =>
  import("./pages/activity-logs/ActivityLogDetailPage").then((m) => ({
    default: m.ActivityLogDetailPage,
  })),
);
const LogsPage = lazyPage(() =>
  import("./pages/logs/LogsPage").then((m) => ({ default: m.LogsPage })),
);
const SettingsPage = lazyPage(() =>
  import("./pages/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
const BackupPage = lazyPage(() =>
  import("./pages/backup/BackupPage").then((m) => ({ default: m.BackupPage })),
);

// ── Warehouses ──
const WarehouseIndexPage = lazyPage(() =>
  import("./pages/warehouse/WarehouseIndexPage").then((m) => ({
    default: m.WarehouseIndexPage,
  })),
);
const WarehouseDetailPage = lazyPage(() =>
  import("./pages/warehouse/WarehouseDetailPage").then((m) => ({
    default: m.WarehouseDetailPage,
  })),
);
const WarehouseFormPage = lazyPage(() =>
  import("./pages/warehouse/WarehouseFormPage").then((m) => ({
    default: m.WarehouseFormPage,
  })),
);
/** 3D layout — the only route that pulls three.js / drei / three-stdlib. */
const WarehouseLayoutPage = lazyPage(() =>
  import("./pages/warehouse/warehouse-layout-3d/WarehouseLayoutPage").then(
    (m) => ({ default: m.WarehouseLayoutPage }),
  ),
);

// ── Master data ──
const SkuIndexPage = lazyPage(() =>
  import("./pages/sku/SkuIndexPage").then((m) => ({ default: m.SkuIndexPage })),
);
const SkuDetailPage = lazyPage(() =>
  import("./pages/sku/SkuDetailPage").then((m) => ({
    default: m.SkuDetailPage,
  })),
);
const SupplierIndexPage = lazyPage(() =>
  import("./pages/suppliers/SupplierIndexPage").then((m) => ({
    default: m.SupplierIndexPage,
  })),
);
const SupplierDetailPage = lazyPage(() =>
  import("./pages/suppliers/SupplierDetailPage").then((m) => ({
    default: m.SupplierDetailPage,
  })),
);
const SupplierFormPage = lazyPage(() =>
  import("./pages/suppliers/SupplierFormPage").then((m) => ({
    default: m.SupplierFormPage,
  })),
);
const ProductIndexPage = lazyPage(() =>
  import("./pages/products/ProductIndexPage").then((m) => ({
    default: m.ProductIndexPage,
  })),
);
const ProductDetailPage = lazyPage(() =>
  import("./pages/products/ProductDetailPage").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const ProductFormPage = lazyPage(() =>
  import("./pages/products/ProductFormPage").then((m) => ({
    default: m.ProductFormPage,
  })),
);

// ── Pallets & transfers ──
const PalletIndexPage = lazyPage(() =>
  import("./pages/pallets").then((m) => ({ default: m.PalletIndexPage })),
);
const PalletDetailPage = lazyPage(() =>
  import("./pages/pallets/PalletDetailPage").then((m) => ({
    default: m.PalletDetailPage,
  })),
);
const SubinventoryTransferIndexPage = lazyPage(() =>
  import("./pages/subinventory-transfer").then((m) => ({
    default: m.SubinventoryTransferIndexPage,
  })),
);
const SubinventoryTransferDetailPage = lazyPage(() =>
  import("./pages/subinventory-transfer/SubinventoryTransferDetailPage").then(
    (m) => ({ default: m.SubinventoryTransferDetailPage }),
  ),
);
const SubinventoryTransferFormPage = lazyPage(() =>
  import("./pages/subinventory-transfer/SubinventoryTransferFormPage").then(
    (m) => ({ default: m.SubinventoryTransferFormPage }),
  ),
);

// ── Inbound ──
const InboundTransactionIndexPage = lazyPage(() =>
  import("./pages/inbound-transaction").then((m) => ({
    default: m.InboundTransactionIndexPage,
  })),
);
const ReceivingTransactionDetailPage = lazyPage(() =>
  import("./pages/inbound-transaction/receiving/ReceivingTransactionDetailPage").then(
    (m) => ({ default: m.ReceivingTransactionDetailPage }),
  ),
);
const ReceivingTransactionFormPage = lazyPage(() =>
  import("./pages/inbound-transaction/receiving/ReceivingTransactionFormPage").then(
    (m) => ({ default: m.ReceivingTransactionFormPage }),
  ),
);
const FoundTransactionDetailPage = lazyPage(() =>
  import("./pages/inbound-transaction/found/FoundTransactionDetailPage").then(
    (m) => ({ default: m.FoundTransactionDetailPage }),
  ),
);
const FoundTransactionFormPage = lazyPage(() =>
  import("./pages/inbound-transaction/found/FoundTransactionFormPage").then(
    (m) => ({ default: m.FoundTransactionFormPage }),
  ),
);
const RmaReceiptDetailPage = lazyPage(() =>
  import("./pages/inbound-transaction/rma-receipt/RmaReceiptDetailPage").then(
    (m) => ({ default: m.RmaReceiptDetailPage }),
  ),
);
const RmaReceiptFormPage = lazyPage(() =>
  import("./pages/inbound-transaction/rma-receipt/RmaReceiptFormPage").then(
    (m) => ({ default: m.RmaReceiptFormPage }),
  ),
);
const WipCompletionDetailPage = lazyPage(() =>
  import("./pages/inbound-transaction/wip-completion/WipCompletionDetailPage").then(
    (m) => ({ default: m.WipCompletionDetailPage }),
  ),
);
const WipCompletionFormPage = lazyPage(() =>
  import("./pages/inbound-transaction/wip-completion/WipCompletionFormPage").then(
    (m) => ({ default: m.WipCompletionFormPage }),
  ),
);

// ── Outbound ──
const OutboundTransactionIndexPage = lazyPage(() =>
  import("./pages/outbound-transaction").then((m) => ({
    default: m.OutboundTransactionIndexPage,
  })),
);
const ShipmentDetailPage = lazyPage(() =>
  import("./pages/outbound-transaction/shipment/ShipmentDetailPage").then(
    (m) => ({ default: m.ShipmentDetailPage }),
  ),
);
const ShipmentFormPage = lazyPage(() =>
  import("./pages/outbound-transaction/shipment/ShipmentFormPage").then(
    (m) => ({ default: m.ShipmentFormPage }),
  ),
);
const DisposalDetailPage = lazyPage(() =>
  import("./pages/outbound-transaction/disposal/DisposalDetailPage").then(
    (m) => ({ default: m.DisposalDetailPage }),
  ),
);
const DisposalFormPage = lazyPage(() =>
  import("./pages/outbound-transaction/disposal/DisposalFormPage").then(
    (m) => ({ default: m.DisposalFormPage }),
  ),
);
const LossTransactionDetailPage = lazyPage(() =>
  import("./pages/outbound-transaction/loss/LossTransactionDetailPage").then(
    (m) => ({ default: m.LossTransactionDetailPage }),
  ),
);
const LossTransactionFormPage = lazyPage(() =>
  import("./pages/outbound-transaction/loss/LossTransactionFormPage").then(
    (m) => ({ default: m.LossTransactionFormPage }),
  ),
);
const ReturnToSupplierDetailPage = lazyPage(() =>
  import("./pages/outbound-transaction/return-to-supplier/ReturnToSupplierDetailPage").then(
    (m) => ({ default: m.ReturnToSupplierDetailPage }),
  ),
);
const ReturnToSupplierFormPage = lazyPage(() =>
  import("./pages/outbound-transaction/return-to-supplier/ReturnToSupplierFormPage").then(
    (m) => ({ default: m.ReturnToSupplierFormPage }),
  ),
);
const WipIssueDetailPage = lazyPage(() =>
  import("./pages/outbound-transaction/wip-issue/WipIssueDetailPage").then(
    (m) => ({ default: m.WipIssueDetailPage }),
  ),
);
const WipIssueFormPage = lazyPage(() =>
  import("./pages/outbound-transaction/wip-issue/WipIssueFormPage").then(
    (m) => ({ default: m.WipIssueFormPage }),
  ),
);

// ── Stock count & purchase order ──
const StockCountIndexPage = lazyPage(() =>
  import("./pages/stock-count/StockCountIndexPage").then((m) => ({
    default: m.StockCountIndexPage,
  })),
);
const StockCountFormPage = lazyPage(() =>
  import("./pages/stock-count/StockCountFormPage").then((m) => ({
    default: m.StockCountFormPage,
  })),
);
const StockCountDetailPage = lazyPage(() =>
  import("./pages/stock-count/StockCountDetailPage").then((m) => ({
    default: m.StockCountDetailPage,
  })),
);
const PurchaseOrderIndexPage = lazyPage(() =>
  import("./pages/purchase-order/PurchaseOrderIndexPage").then((m) => ({
    default: m.PurchaseOrderIndexPage,
  })),
);
const PurchaseOrderFormPage = lazyPage(() =>
  import("./pages/purchase-order/PurchaseOrderFormPage").then((m) => ({
    default: m.PurchaseOrderFormPage,
  })),
);
const PurchaseOrderDetailPage = lazyPage(() =>
  import("./pages/purchase-order/PurchaseOrderDetailPage").then((m) => ({
    default: m.PurchaseOrderDetailPage,
  })),
);

// ── Reports (recharts) ──
const MonthlyStockMovementPage = lazyPage(() =>
  import("./pages/reports/MonthlyStockMovementPage").then((m) => ({
    default: m.MonthlyStockMovementPage,
  })),
);
const SkuStockMovementDetailPage = lazyPage(() =>
  import("./pages/reports/SkuStockMovementDetailPage").then((m) => ({
    default: m.SkuStockMovementDetailPage,
  })),
);
const InventoryBalancePage = lazyPage(() =>
  import("./pages/reports/InventoryBalancePage").then((m) => ({
    default: m.InventoryBalancePage,
  })),
);
const ReportsDashboardPage = lazyPage(() =>
  import("./pages/reports/ReportsDashboardPage").then((m) => ({
    default: m.ReportsDashboardPage,
  })),
);
const ExpiryReportPage = lazyPage(() =>
  import("./pages/reports/ExpiryReportPage").then((m) => ({
    default: m.ExpiryReportPage,
  })),
);

// ── AI ──
const AiAdminPage = lazyPage(() =>
  import("./pages/ai-admin/AiAdminPage").then((m) => ({ default: m.default })),
);
const AiAnalyticsPage = lazyPage(() =>
  import("./pages/ai-analytics/AiAnalyticsPage").then((m) => ({
    default: m.default,
  })),
);
const KnowledgeIndexPage = lazyPage(() =>
  import("./pages/knowledge/KnowledgeIndexPage").then((m) => ({
    default: m.KnowledgeIndexPage,
  })),
);
const KnowledgeDetailPage = lazyPage(() =>
  import("./pages/knowledge/KnowledgeDetailPage").then((m) => ({
    default: m.KnowledgeDetailPage,
  })),
);
const KnowledgeFormPage = lazyPage(() =>
  import("./pages/knowledge/KnowledgeFormPage").then((m) => ({
    default: m.KnowledgeFormPage,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/login",
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <PrivateLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "users",
        children: [
          {
            index: true,
            element: <UsersIndexPage />,
          },
          {
            path: "new",
            element: <UserFormPage />,
          },
          {
            path: ":id",
            element: <UserDetailPage />,
          },
          {
            path: ":id/edit",
            element: <UserFormPage />,
          },
        ],
      },
      {
        path: "access-control",
        children: [
          {
            path: "roles",
            children: [
              {
                index: true,
                element: <RolesIndexPage />,
              },
              {
                path: "new",
                element: <RoleFormPage />,
              },
              {
                path: ":id/edit",
                element: <RoleFormPage />,
              },
            ],
          },
        ],
      },
      {
        path: "activity-logs",
        children: [
          {
            index: true,
            element: <ActivityLogsIndexPage />,
          },
          {
            path: ":id",
            element: <ActivityLogDetailPage />,
          },
        ],
      },
      {
        path: "warehouse",
        children: [
          {
            index: true,
            element: <WarehouseIndexPage />,
          },
          {
            path: "new",
            element: <WarehouseFormPage />,
          },
          {
            path: ":id",
            element: <WarehouseDetailPage />,
          },
          {
            path: ":id/edit",
            element: <WarehouseFormPage />,
          },
          {
            path: ":id/layout",
            element: <WarehouseLayoutPage />,
          },
        ],
      },
      {
        path: "skus",
        children: [
          {
            index: true,
            element: <SkuIndexPage />,
          },
          {
            path: ":id",
            element: <SkuDetailPage />,
          },
        ],
      },
      {
        path: "suppliers",
        children: [
          {
            index: true,
            element: <SupplierIndexPage />,
          },
          {
            path: "new",
            element: <SupplierFormPage />,
          },
          {
            path: ":id",
            element: <SupplierDetailPage />,
          },
          {
            path: ":id/edit",
            element: <SupplierFormPage />,
          },
        ],
      },
      {
        path: "products",
        children: [
          {
            index: true,
            element: <ProductIndexPage />,
          },
          {
            path: "new",
            element: <ProductFormPage />,
          },
          {
            path: ":id",
            element: <ProductDetailPage />,
          },
          {
            path: ":id/edit",
            element: <ProductFormPage />,
          },
        ],
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "inbound-transaction",
        children: [
          {
            index: true,
            element: <InboundTransactionIndexPage />,
          },
          {
            path: "receiving/new",
            element: <ReceivingTransactionFormPage />,
          },
          {
            path: "receiving/:id",
            element: <ReceivingTransactionDetailPage />,
          },
          {
            path: "receiving/:id/edit",
            element: <ReceivingTransactionFormPage />,
          },
          {
            path: "found/new",
            element: <FoundTransactionFormPage />,
          },
          {
            path: "found/:id",
            element: <FoundTransactionDetailPage />,
          },
          {
            path: "found/:id/edit",
            element: <FoundTransactionFormPage />,
          },
          {
            path: "rma-receipt/new",
            element: <RmaReceiptFormPage />,
          },
          {
            path: "rma-receipt/:id",
            element: <RmaReceiptDetailPage />,
          },
          {
            path: "rma-receipt/:id/edit",
            element: <RmaReceiptFormPage />,
          },
          {
            path: "wip-completion/new",
            element: <WipCompletionFormPage />,
          },
          {
            path: "wip-completion/:id",
            element: <WipCompletionDetailPage />,
          },
          {
            path: "wip-completion/:id/edit",
            element: <WipCompletionFormPage />,
          },
        ],
      },
      {
        path: "outbound-transaction",
        children: [
          {
            index: true,
            element: <OutboundTransactionIndexPage />,
          },
          {
            path: "shipment/new",
            element: <ShipmentFormPage />,
          },
          {
            path: "shipment/:id",
            element: <ShipmentDetailPage />,
          },
          {
            path: "shipment/:id/edit",
            element: <ShipmentFormPage />,
          },
          {
            path: "disposal/new",
            element: <DisposalFormPage />,
          },
          {
            path: "disposal/:id",
            element: <DisposalDetailPage />,
          },
          {
            path: "disposal/:id/edit",
            element: <DisposalFormPage />,
          },
          {
            path: "loss/new",
            element: <LossTransactionFormPage />,
          },
          {
            path: "loss/:id",
            element: <LossTransactionDetailPage />,
          },
          {
            path: "loss/:id/edit",
            element: <LossTransactionFormPage />,
          },
          {
            path: "return-to-supplier/new",
            element: <ReturnToSupplierFormPage />,
          },
          {
            path: "return-to-supplier/:id",
            element: <ReturnToSupplierDetailPage />,
          },
          {
            path: "return-to-supplier/:id/edit",
            element: <ReturnToSupplierFormPage />,
          },
          {
            path: "wip-issue/new",
            element: <WipIssueFormPage />,
          },
          {
            path: "wip-issue/:id",
            element: <WipIssueDetailPage />,
          },
          {
            path: "wip-issue/:id/edit",
            element: <WipIssueFormPage />,
          },
        ],
      },
      {
        path: "stock-movement",
        element: <StockMovementPage />,
      },
      {
        path: "subinventory-transfer",
        children: [
          {
            index: true,
            element: <SubinventoryTransferIndexPage />,
          },
          {
            path: "new",
            element: <SubinventoryTransferFormPage />,
          },
          {
            path: ":id",
            element: <SubinventoryTransferDetailPage />,
          },
          {
            path: ":id/edit",
            element: <SubinventoryTransferFormPage />,
          },
        ],
      },
      {
        path: "pallets",
        children: [
          {
            index: true,
            element: <PalletIndexPage />,
          },
          {
            path: ":id",
            element: <PalletDetailPage />,
          },
        ],
      },
      {
        path: "reports",
        children: [
          {
            path: "monthly-stock-movement",
            element: <MonthlyStockMovementPage />,
          },
          {
            path: "monthly-stock-movement/:skuId",
            element: <SkuStockMovementDetailPage />,
          },
          {
            path: "inventory-balance",
            element: <InventoryBalancePage />,
          },
          {
            path: "charts",
            element: <ReportsDashboardPage />,
          },
          {
            path: "expiry",
            element: <ExpiryReportPage />,
          },
        ],
      },
      {
        path: "inventory-aging",
        element: <InventoryAgingPage />,
      },
      {
        path: "knowledge",
        children: [
          {
            index: true,
            element: <KnowledgeIndexPage />,
          },
          {
            path: "new",
            element: <KnowledgeFormPage />,
          },
          {
            path: ":id",
            element: <KnowledgeDetailPage />,
          },
          {
            path: ":id/edit",
            element: <KnowledgeFormPage />,
          },
        ],
      },
      {
        path: "ai-admin",
        element: <AiAdminPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "settings/backup",
        element: <BackupPage />,
      },
      {
        path: "logs",
        element: <LogsPage />,
      },
      {
        path: "reorder",
        element: <ReorderPage />,
      },
      {
        path: "stock-count",
        children: [
          {
            index: true,
            element: <StockCountIndexPage />,
          },
          {
            path: "new",
            element: <StockCountFormPage />,
          },
          {
            path: ":id",
            element: <StockCountDetailPage />,
          },
        ],
      },
      {
        path: "purchase-order",
        children: [
          {
            index: true,
            element: <PurchaseOrderIndexPage />,
          },
          {
            path: "new",
            element: <PurchaseOrderFormPage />,
          },
          {
            path: ":id",
            element: <PurchaseOrderDetailPage />,
          },
          {
            path: ":id/edit",
            element: <PurchaseOrderFormPage />,
          },
        ],
      },
      {
        path: "ai-analytics",
        element: <AiAnalyticsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
