import type { ReactNode } from "react";
import {
  Button,
  Card,
  Chip,
  Input,
  Modal,
  Spinner,
  Table,
  Tabs,
} from "@heroui/react";
import { AppIcon } from "../components/AppIcon";
import type { IconName } from "../components/AppIcon";
import { PlusIcon } from "../assets/IconRegistry";

export interface ApprovalHistoryEntry {
  message?: string;
  process: string;
  timeframe: string;
  userName: string;
}

const STATUS_FILTER_ALL = "ALL" as const;
const STATUS_FILTER_OPTIONS = [
  "DRAFT",
  "PROPOSED",
  "APPROVED",
  "REJECTED",
] as const;

/**
 * Shared approval-status filter tabs used by all transaction tables.
 * Returns the selected status value (or undefined when "All" is selected).
 */
export function StatusFilterTabs({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (status: string) => void;
  ariaLabel: string;
}) {
  return (
    <Tabs
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label={ariaLabel}>
          <Tabs.Tab id={STATUS_FILTER_ALL}>
            All
            <Tabs.Indicator />
          </Tabs.Tab>
          {STATUS_FILTER_OPTIONS.map((status) => (
            <Tabs.Tab key={status} id={status}>
              {status}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

export const STATUS_FILTER_ALL_VALUE = STATUS_FILTER_ALL;

/**
 * Shared toolbar for transaction tables — groups search, create button, and
 * status filter tabs into one cohesive row that sits directly above the table.
 */
export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  createLabel,
  onCreate,
  statusFilter,
  onStatusFilterChange,
  statusFilterAriaLabel,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  createLabel?: string;
  onCreate?: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  statusFilterAriaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search + Create row */}
      <div className="flex items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            fullWidth
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            variant="secondary"
          />
        </div>
        {onCreate ? (
          <Button variant="primary" onPress={onCreate}>
            <PlusIcon size={16} />
            {createLabel}
          </Button>
        ) : null}
      </div>
      {/* Status filter tabs */}
      <StatusFilterTabs
        value={statusFilter}
        onChange={onStatusFilterChange}
        ariaLabel={statusFilterAriaLabel}
      />
    </div>
  );
}

export type EditableApprovalStatus = "DRAFT" | "PROPOSED";

type StatusChipColor = "accent" | "default" | "success" | "warning" | "danger";

const APPROVAL_STATUS_COLOR_MAP: Record<string, StatusChipColor> = {
  APPROVED: "success",
  DRAFT: "default",
  PROPOSED: "warning",
  REJECTED: "danger",
};

export function ApprovalStatusChip({
  status,
}: {
  status: string | null | undefined;
}) {
  const resolvedStatus = status ?? "-";
  return (
    <Chip
      color={APPROVAL_STATUS_COLOR_MAP[resolvedStatus] ?? "default"}
      size="sm"
      variant="soft"
    >
      {resolvedStatus}
    </Chip>
  );
}

export function DetailField({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <div
        className={
          mono
            ? "mt-2 break-all font-mono text-sm text-foreground"
            : "mt-2 text-sm text-foreground"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function TransactionListLayout({
  children,
  createLabel,
  description,
  onCreate,
  onSearchChange,
  searchPlaceholder,
  searchValue,
  title,
}: {
  children: ReactNode;
  createLabel?: string;
  description: string;
  onCreate?: () => void;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchValue: string;
  title: string;
}) {
  return (
    <Card>
      <Card.Header>
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <Card.Description>{description}</Card.Description>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="w-full sm:w-80">
              <Input
                fullWidth
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                variant="secondary"
              />
            </div>
            {onCreate ? (
              <Button variant="primary" onPress={onCreate}>
                <AppIcon name="plus" className="size-4" />
                {createLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

export function TableEmptyStateContent({
  icon,
  message,
}: {
  icon: IconName;
  message: string;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
      <AppIcon name={icon} className="size-6 text-muted" />
      <span className="text-sm text-muted">{message}</span>
    </div>
  );
}

export function TableLoadingRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <Table.Row id="loading-row">
      <Table.Cell colSpan={colSpan}>
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Spinner size="sm" />
          {message}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

export function TransactionDeleteModal({
  body,
  confirmLabel,
  isDeleting,
  isOpen,
  onConfirm,
  onOpenChange,
  title,
}: {
  body: string;
  confirmLabel: string;
  isDeleting: boolean;
  isOpen: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </Modal.Header>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isDisabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function TransactionFormCard({
  actions,
  children,
  description,
  title,
}: {
  actions: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card variant="secondary">
      <Card.Header>
        <div>
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
      </Card.Content>
      <Card.Footer>
        <div className="flex w-full justify-end gap-2">{actions}</div>
      </Card.Footer>
    </Card>
  );
}
