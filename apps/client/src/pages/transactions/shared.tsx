import type { ReactNode } from 'react';
import { Button, Card, Chip, FieldError, Input, Label, ListBox, Modal, Select, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';

export interface ApprovalHistoryEntry {
  message?: string;
  process: string;
  timeframe: string;
  userName: string;
}

export type EditableApprovalStatus = 'DRAFT' | 'PENDING';

type StatusChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

const APPROVAL_STATUS_COLOR_MAP: Record<string, StatusChipColor> = {
  APPROVED: 'success',
  DRAFT: 'default',
  PENDING: 'warning',
  REJECTED: 'danger',
};

export function ApprovalStatusChip({ status }: { status: string | null | undefined }) {
  const resolvedStatus = status ?? '-';

  return (
    <Chip color={APPROVAL_STATUS_COLOR_MAP[resolvedStatus] ?? 'default'} size="sm" variant="soft">
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className={mono ? 'mt-2 break-all font-mono text-sm text-foreground' : 'mt-2 text-sm text-foreground'}>{value}</div>
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
  createLabel: string;
  description: string;
  onCreate: () => void;
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
            <Button variant="primary" onPress={onCreate}>
              <Icon icon="material-symbols:add-2-rounded" className="size-4" />
              {createLabel}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

export function TableEmptyStateContent({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
      <Icon icon={icon} className="size-6 text-muted" />
      <span className="text-sm text-muted">{message}</span>
    </div>
  );
}

export function TableLoadingRow({ colSpan, message }: { colSpan: number; message: string }) {
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
              <Button variant="danger" onPress={onConfirm} isDisabled={isDeleting}>
                {isDeleting ? 'Deleting...' : confirmLabel}
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

export function DetailSectionCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card variant="secondary">
      <Card.Header>
        <Card.Title className="text-base">{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

export function TransactionTextField({
  error,
  isDisabled,
  isInvalid,
  isRequired,
  label,
  name,
  onChange,
  placeholder,
  type,
  value,
}: {
  error?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'date' | 'email' | 'number' | 'password' | 'text';
  value: string;
}) {
  return (
    <TextField
      fullWidth
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isRequired={isRequired}
      name={name}
      onChange={onChange}
      type={type}
      value={value}
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} variant="secondary" />
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
}

export function TransactionStatusSelect({
  isDisabled,
  isInvalid,
  label,
  onChange,
  value,
}: {
  isDisabled?: boolean;
  isInvalid?: boolean;
  label: string;
  onChange: (value: EditableApprovalStatus) => void;
  value: EditableApprovalStatus;
}) {
  return (
    <Select fullWidth isDisabled={isDisabled} isInvalid={isInvalid} name="approvalStatus" value={value} onChange={(nextValue) => onChange(String(nextValue ?? 'DRAFT') as EditableApprovalStatus)} variant="secondary">
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="DRAFT" textValue="Draft">
            Draft
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="PENDING" textValue="Propose">
            Propose
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
      {isInvalid ? <FieldError>Status is required.</FieldError> : null}
    </Select>
  );
}

export function splitCommaSeparatedValues(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toEditableApprovalStatus(value: string | null | undefined): EditableApprovalStatus {
  return value === 'PENDING' ? 'PENDING' : 'DRAFT';
}

export function normalizeApprovalHistory(value: unknown): ApprovalHistoryEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.process !== 'string' ||
      typeof candidate.userName !== 'string' ||
      typeof candidate.timeframe !== 'string'
    ) {
      return [];
    }

    return [{
      process: candidate.process,
      userName: candidate.userName,
      timeframe: candidate.timeframe,
      ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
    }];
  });
}