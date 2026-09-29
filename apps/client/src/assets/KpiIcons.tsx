import type { SVGProps } from "react";

/**
 * Flat minimalist KPI icons.
 *
 * Each icon is a 64×64 rounded rect (rx=14) with a solid color background
 * and a pure-white geometric glyph — matching the nav icon style so the
 * dashboard feels cohesive with the sidebar.
 */

type KpiIconProps = SVGProps<SVGSVGElement> & { size?: number };

import PalletsSvg from "./icons/kpi-pallets.svg?react";
import AvailablePalletsSvg from "./icons/kpi-available-pallets.svg?react";
import PendingApprovalsSvg from "./icons/kpi-pending-approvals.svg?react";
import PutawayQueueSvg from "./icons/kpi-putaway-queue.svg?react";
import DispatchQueueSvg from "./icons/kpi-dispatch-queue.svg?react";

export const KpiPalletsIcon = ({ size = 44, ...props }: KpiIconProps) => (
  <PalletsSvg width={size} height={size} {...props} />
);

export const KpiAvailablePalletsIcon = ({
  size = 44,
  ...props
}: KpiIconProps) => (
  <AvailablePalletsSvg width={size} height={size} {...props} />
);

export const KpiPendingApprovalsIcon = ({
  size = 44,
  ...props
}: KpiIconProps) => (
  <PendingApprovalsSvg width={size} height={size} {...props} />
);

export const KpiPutawayQueueIcon = ({ size = 44, ...props }: KpiIconProps) => (
  <PutawayQueueSvg width={size} height={size} {...props} />
);

export const KpiDispatchQueueIcon = ({ size = 44, ...props }: KpiIconProps) => (
  <DispatchQueueSvg width={size} height={size} {...props} />
);
