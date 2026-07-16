import type { SVGProps } from 'react';

/**
 * Colorful nav icons loaded from SVG files.
 *
 * Each icon is a 64×64 rounded rect (rx=14) with:
 * - Light tinted background
 * - Multi-color geometric glyphs (2-4 colors per icon)
 */

type NavIconProps = SVGProps<SVGSVGElement> & { size?: number };

// Import SVG files from icons folder
import DashboardSvg from './icons/nav-dashboard.svg?react';
import AccessControlSvg from './icons/nav-access-control.svg?react';
import UsersSvg from './icons/nav-users.svg?react';
import RolesSvg from './icons/nav-roles.svg?react';
import WarehousesSvg from './icons/nav-warehouses.svg?react';
import SkusSvg from './icons/nav-skus.svg?react';
import SuppliersSvg from './icons/nav-suppliers.svg?react';
import ProductsSvg from './icons/nav-products.svg?react';
import ActivityLogsSvg from './icons/nav-activity-logs.svg?react';
import NotificationsSvg from './icons/nav-notifications.svg?react';
import InboundSvg from './icons/nav-inbound.svg?react';
import OutboundSvg from './icons/nav-outbound.svg?react';
import SubinventorySvg from './icons/nav-subinventory.svg?react';
import PalletsSvg from './icons/nav-pallets.svg?react';
import StockMovementSvg from './icons/nav-stock-movement.svg?react';
import ReportsSvg from './icons/nav-reports.svg?react';
import MonthlyStockSvg from './icons/nav-monthly-stock.svg?react';
import InventoryBalanceSvg from './icons/nav-inventory-balance.svg?react';
import AnalyticsSvg from './icons/nav-analytics.svg?react';
import InventoryAgingSvg from './icons/nav-inventory-aging.svg?react';
import AiAdminSvg from './icons/nav-ai-admin.svg?react';

/* ── Dashboard (emerald bg, white bars) ────────────────────── */
export const NavDashboardIcon = ({ size = 48, ...props }: NavIconProps) => (
  <DashboardSvg width={size} height={size} {...props} />
);

/* ── Access Control (rose bg, white shield) ────────────────── */
export const NavAccessControlIcon = ({ size = 48, ...props }: NavIconProps) => (
  <AccessControlSvg width={size} height={size} {...props} />
);

/* ── Users (sky bg, white people) ──────────────────────────── */
export const NavUsersIcon = ({ size = 48, ...props }: NavIconProps) => (
  <UsersSvg width={size} height={size} {...props} />
);

/* ── Roles (violet bg, white badge) ────────────────────────── */
export const NavRolesIcon = ({ size = 48, ...props }: NavIconProps) => (
  <RolesSvg width={size} height={size} {...props} />
);

/* ── Warehouses (emerald bg, white building) ───────────────── */
export const NavWarehousesIcon = ({ size = 48, ...props }: NavIconProps) => (
  <WarehousesSvg width={size} height={size} {...props} />
);

/* ── SKUs (amber bg, white tag) ────────────────────────────── */
export const NavSkusIcon = ({ size = 48, ...props }: NavIconProps) => (
  <SkusSvg width={size} height={size} {...props} />
);

/* ── Suppliers (cyan bg, white storefront) ─────────────────── */
export const NavSuppliersIcon = ({ size = 48, ...props }: NavIconProps) => (
  <SuppliersSvg width={size} height={size} {...props} />
);

/* ── Products (fuchsia bg, white box) ──────────────────────── */
export const NavProductsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <ProductsSvg width={size} height={size} {...props} />
);

/* ── Activity Logs (slate bg, white document) ──────────────── */
export const NavActivityLogsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <ActivityLogsSvg width={size} height={size} {...props} />
);

/* ── Notifications (red bg, white bell) ────────────────────── */
export const NavNotificationsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <NotificationsSvg width={size} height={size} {...props} />
);

/* ── Inbound Transactions (green bg, white document + arrow) ─── */
export const NavInboundIcon = ({ size = 48, ...props }: NavIconProps) => (
  <InboundSvg width={size} height={size} {...props} />
);

/* ── Outbound Transactions (orange bg, white document + arrow)  */
export const NavOutboundIcon = ({ size = 48, ...props }: NavIconProps) => (
  <OutboundSvg width={size} height={size} {...props} />
);

/* ── Subinventory Transfer (blue bg, white boxes + arrows) ─── */
export const NavSubinventoryIcon = ({ size = 48, ...props }: NavIconProps) => (
  <SubinventorySvg width={size} height={size} {...props} />
);

/* ── Pallets (lime bg, white pallet) ───────────────────────── */
export const NavPalletsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <PalletsSvg width={size} height={size} {...props} />
);

/* ── Stock Movement (teal bg, white chart) ─────────────────── */
export const NavStockMovementIcon = ({ size = 48, ...props }: NavIconProps) => (
  <StockMovementSvg width={size} height={size} {...props} />
);

/* ── Reports (purple bg, white bars) ──────────────────────── */
export const NavReportsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <ReportsSvg width={size} height={size} {...props} />
);

/* ── Monthly Stock (indigo bg, white calendar) ─────────────── */
export const NavMonthlyStockIcon = ({ size = 48, ...props }: NavIconProps) => (
  <MonthlyStockSvg width={size} height={size} {...props} />
);

/* ── Inventory Balance (blue bg, white scales) ─────────────── */
export const NavInventoryBalanceIcon = ({ size = 48, ...props }: NavIconProps) => (
  <InventoryBalanceSvg width={size} height={size} {...props} />
);

/* ── Analytics (purple bg, white line chart) ───────────────── */
export const NavAnalyticsIcon = ({ size = 48, ...props }: NavIconProps) => (
  <AnalyticsSvg width={size} height={size} {...props} />
);

/* ── Inventory Aging (amber bg, white warning triangle) ────── */
export const NavInventoryAgingIcon = ({ size = 48, ...props }: NavIconProps) => (
  <InventoryAgingSvg width={size} height={size} {...props} />
);

/* ── AI Admin (purple bg, neural network grid) ─────────────── */
export const NavAiAdminIcon = ({ size = 48, ...props }: NavIconProps) => (
  <AiAdminSvg width={size} height={size} {...props} />
);

/* ── Registry: maps nav-menu icon keys → components ────────── */
export const NAV_ICON_REGISTRY: Record<string, (props: NavIconProps) => React.ReactElement> = {
  'nav:dashboard': NavDashboardIcon,
  'nav:access-control': NavAccessControlIcon,
  'nav:users': NavUsersIcon,
  'nav:roles': NavRolesIcon,
  'nav:warehouses': NavWarehousesIcon,
  'nav:skus': NavSkusIcon,
  'nav:suppliers': NavSuppliersIcon,
  'nav:products': NavProductsIcon,
  'nav:activity-logs': NavActivityLogsIcon,
  'nav:notifications': NavNotificationsIcon,
  'nav:inbound': NavInboundIcon,
  'nav:outbound': NavOutboundIcon,
  'nav:subinventory': NavSubinventoryIcon,
  'nav:pallets': NavPalletsIcon,
  'nav:stock-movement': NavStockMovementIcon,
  'nav:reports': NavReportsIcon,
  'nav:monthly-stock': NavMonthlyStockIcon,
  'nav:inventory-balance': NavInventoryBalanceIcon,
  'nav:analytics': NavAnalyticsIcon,
  'nav:inventory-aging': NavInventoryAgingIcon,
  'nav:ai-admin': NavAiAdminIcon,
};
