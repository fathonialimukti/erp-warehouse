import type { SVGProps } from 'react';

/**
 * SVG-based icon registry — replaces the old inline Icon.tsx.
 * All icons are loaded from individual SVG files via ?react.
 *
 * Line icons: 24×24 viewBox, stroke-based, inherit currentColor.
 * Colorful icons: self-contained gradients, sizes vary.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/* ── Line Icons ─────────────────────────────────────────────── */

import DocumentSvg from './icons/icon-document.svg?react';
export const DocumentIcon = ({ size = 20, ...props }: IconProps) => (
  <DocumentSvg width={size} height={size} {...props} />
);

import TruckSvg from './icons/icon-truck.svg?react';
export const TruckIcon = ({ size = 20, ...props }: IconProps) => (
  <TruckSvg width={size} height={size} {...props} />
);

import NotesSvg from './icons/icon-notes.svg?react';
export const NotesIcon = ({ size = 20, ...props }: IconProps) => (
  <NotesSvg width={size} height={size} {...props} />
);

import BoxSvg from './icons/icon-box.svg?react';
export const BoxIcon = ({ size = 20, ...props }: IconProps) => (
  <BoxSvg width={size} height={size} {...props} />
);

import PlusSvg from './icons/icon-plus.svg?react';
export const PlusIcon = ({ size = 20, ...props }: IconProps) => (
  <PlusSvg width={size} height={size} {...props} />
);

import SaveSvg from './icons/icon-save.svg?react';
export const SaveIcon = ({ size = 20, ...props }: IconProps) => (
  <SaveSvg width={size} height={size} {...props} />
);

import SendSvg from './icons/icon-send.svg?react';
export const SendIcon = ({ size = 20, ...props }: IconProps) => (
  <SendSvg width={size} height={size} {...props} />
);

import ArrowUpSvg from './icons/icon-arrow-up.svg?react';
export const ArrowUpIcon = ({ size = 16, ...props }: IconProps) => (
  <ArrowUpSvg width={size} height={size} {...props} />
);

import ArrowDownSvg from './icons/icon-arrow-down.svg?react';
export const ArrowDownIcon = ({ size = 16, ...props }: IconProps) => (
  <ArrowDownSvg width={size} height={size} {...props} />
);

import TrashSvg from './icons/icon-trash.svg?react';
export const TrashIcon = ({ size = 16, ...props }: IconProps) => (
  <TrashSvg width={size} height={size} {...props} />
);

import PaperclipSvg from './icons/icon-paperclip.svg?react';
export const PaperclipIcon = ({ size = 20, ...props }: IconProps) => (
  <PaperclipSvg width={size} height={size} {...props} />
);

import CheckCircleSvg from './icons/icon-check-circle.svg?react';
export const CheckCircleIcon = ({ size = 20, ...props }: IconProps) => (
  <CheckCircleSvg width={size} height={size} {...props} />
);

import CloseCircleSvg from './icons/icon-close-circle.svg?react';
export const CloseCircleIcon = ({ size = 20, ...props }: IconProps) => (
  <CloseCircleSvg width={size} height={size} {...props} />
);

import ChevronLeftSvg from './icons/icon-chevron-left.svg?react';
export const ChevronLeftIcon = ({ size = 20, ...props }: IconProps) => (
  <ChevronLeftSvg width={size} height={size} {...props} />
);

import SpinnerSvg from './icons/icon-spinner.svg?react';
export const SpinnerIcon = ({ size = 20, ...props }: IconProps) => (
  <SpinnerSvg width={size} height={size} {...props} />
);

import ClipboardSvg from './icons/icon-clipboard.svg?react';
export const ClipboardIcon = ({ size = 20, ...props }: IconProps) => (
  <ClipboardSvg width={size} height={size} {...props} />
);

import LayersSvg from './icons/icon-layers.svg?react';
export const LayersIcon = ({ size = 20, ...props }: IconProps) => (
  <LayersSvg width={size} height={size} {...props} />
);

import ScaleSvg from './icons/icon-scale.svg?react';
export const ScaleIcon = ({ size = 20, ...props }: IconProps) => (
  <ScaleSvg width={size} height={size} {...props} />
);

import EyeSvg from './icons/icon-eye.svg?react';
export const EyeIcon = ({ size = 20, ...props }: IconProps) => (
  <EyeSvg width={size} height={size} {...props} />
);

import MenuDotsSvg from './icons/icon-menu-dots.svg?react';
export const MenuDotsIcon = ({ size = 16, ...props }: IconProps) => (
  <MenuDotsSvg width={size} height={size} {...props} />
);

import PenSvg from './icons/icon-pen.svg?react';
export const PenIcon = ({ size = 16, ...props }: IconProps) => (
  <PenSvg width={size} height={size} {...props} />
);

import PutawaySvg from './icons/icon-putaway.svg?react';
export const PutawayIcon = ({ size = 20, ...props }: IconProps) => (
  <PutawaySvg width={size} height={size} {...props} />
);

import DownloadSvg from './icons/icon-download.svg?react';
export const DownloadIcon = ({ size = 20, ...props }: IconProps) => (
  <DownloadSvg width={size} height={size} {...props} />
);

import InfoSvg from './icons/icon-info.svg?react';
export const InfoIcon = ({ size = 16, ...props }: IconProps) => (
  <InfoSvg width={size} height={size} {...props} />
);

/* ── Colorful Transaction-Type Icons ────────────────────────── */

type ColorfulIconProps = { size?: number; className?: string };

import ReceivingTypeSvg from './icons/icon-receiving-type.svg?react';
export const ReceivingTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <ReceivingTypeSvg width={size} height={size} className={className} />
);

import WipCompletionTypeSvg from './icons/icon-wip-completion-type.svg?react';
export const WipCompletionTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <WipCompletionTypeSvg width={size} height={size} className={className} />
);

import RmaReceiptTypeSvg from './icons/icon-rma-receipt-type.svg?react';
export const RmaReceiptTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <RmaReceiptTypeSvg width={size} height={size} className={className} />
);

import FoundTypeSvg from './icons/icon-found-type.svg?react';
export const FoundTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <FoundTypeSvg width={size} height={size} className={className} />
);

import InboundHeroSvg from './icons/icon-inbound-hero.svg?react';
export const InboundHeroIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <InboundHeroSvg width={size} height={size} className={className} />
);

import ShipmentTypeSvg from './icons/icon-shipment-type.svg?react';
export const ShipmentTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <ShipmentTypeSvg width={size} height={size} className={className} />
);

import WipIssueTypeSvg from './icons/icon-wip-issue-type.svg?react';
export const WipIssueTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <WipIssueTypeSvg width={size} height={size} className={className} />
);

import ReturnToSupplierTypeSvg from './icons/icon-return-to-supplier-type.svg?react';
export const ReturnToSupplierTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <ReturnToSupplierTypeSvg width={size} height={size} className={className} />
);

import DisposalTypeSvg from './icons/icon-disposal-type.svg?react';
export const DisposalTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <DisposalTypeSvg width={size} height={size} className={className} />
);

import LossTypeSvg from './icons/icon-loss-type.svg?react';
export const LossTypeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <LossTypeSvg width={size} height={size} className={className} />
);

import OutboundHeroSvg from './icons/icon-outbound-hero.svg?react';
export const OutboundHeroIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <OutboundHeroSvg width={size} height={size} className={className} />
);

import ThemeSvg from './icons/icon-theme.svg?react';
export const ThemeIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <ThemeSvg width={size} height={size} className={className} />
);

import NotificationsSvg from './icons/icon-notifications.svg?react';
export const NotificationsIcon = ({ size = 24, className }: ColorfulIconProps) => (
  <NotificationsSvg width={size} height={size} className={className} />
);