import { Card, Spinner, Chip } from '@heroui/react';
import { Trash2, AlertCircle, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Loading Spinner Component
interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({
  label = 'Loading',
  size = 'lg',
}: LoadingSpinnerProps) {
  return (
    <div className='flex flex-col items-center justify-center min-h-100 gap-4'>
      <Spinner color='current' size={size} label={label} />
    </div>
  );
}

// Status Badge Component
type StatusType =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'released'
  | 'verified'
  | 'submitted'
  | 'active'
  | 'inactive';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    const statusLower = status.toLowerCase();

    // Map status to custom Tailwind colors
    const statusMap: Record<string, { className: string; label: string }> = {
      draft: {
        className: 'bg-cyan-400 text-white border-cyan-500',
        label: 'Draft',
      },
      pending: {
        className: 'bg-amber-500 text-white border-amber-600',
        label: 'Pending',
      },
      approved: {
        className: 'bg-emerald-500 text-white border-emerald-600',
        label: 'Approved',
      },
      rejected: {
        className: 'bg-red-500 text-white border-red-600',
        label: 'Rejected',
      },
      released: {
        className: 'bg-purple-600 text-white border-purple-700',
        label: 'Released',
      },
      verified: {
        className: 'bg-blue-500 text-white border-blue-600',
        label: 'Verified',
      },
      submitted: {
        className: 'bg-indigo-500 text-white border-indigo-600',
        label: 'Submitted',
      },
      active: {
        className: 'bg-emerald-500 text-white border-emerald-600',
        label: 'Active',
      },
      inactive: {
        className: 'bg-gray-400 text-white border-gray-500',
        label: 'Inactive',
      },
    };

    return (
      statusMap[statusLower] || {
        className: 'bg-default-200 text-default-700 border-default-300',
        label: status,
      }
    );
  };

  const config = getStatusConfig(status);

  return (
    <div
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-semibold text-sm ${config.className}`}>
      {config.label}
    </div>
  );
}

// Detail Page Header Component
interface DetailPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DetailPageHeader({
  title,
  subtitle,
  actions,
}: DetailPageHeaderProps) {
  return (
    <Card>
      <div className='card__header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold text-foreground'>{title}</h1>
          {subtitle && (
            <p className='text-sm text-default-500 mt-1'>{subtitle}</p>
          )}
        </div>
        {actions && <div className='flex gap-2'>{actions}</div>}
      </div>
    </Card>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Tidak ada data',
  message,
}: EmptyStateProps) {
  return (
    <Card>
      <div className='card__content'>
        <div className='flex flex-col items-center justify-center py-12 text-center'>
          <div className='mb-4 p-4 bg-default-100 rounded-full'>
            <Icon className='h-12 w-12 text-default-400' />
          </div>
          <h3 className='text-lg font-semibold text-foreground mb-2'>
            {title}
          </h3>
          <p className='text-default-500 max-w-md'>{message}</p>
        </div>
      </div>
    </Card>
  );
}

// Delete Modal Header Component
interface DeleteModalHeaderProps {
  resource: string;
}

export function DeleteModalHeader({ resource }: DeleteModalHeaderProps) {
  return (
    <div className='flex items-center gap-2'>
      <Trash2 className='h-5 w-5 text-danger' />
      <span className='text-foreground'>Hapus {resource}</span>
    </div>
  );
}

// Alert Component for warnings/info
interface AlertProps {
  variant?: 'info' | 'warning' | 'danger';
  children: React.ReactNode;
}

export function Alert({ variant = 'info', children }: AlertProps) {
  const variantClasses = {
    info: 'bg-primary-50 border-primary-200 text-primary-900 dark:bg-primary-950 dark:border-primary-800 dark:text-primary-100',
    warning:
      'bg-warning-50 border-warning-200 text-warning-900 dark:bg-warning-950 dark:border-warning-800 dark:text-warning-100',
    danger:
      'bg-danger-50 border-danger-200 text-danger-900 dark:bg-danger-950 dark:border-danger-800 dark:text-danger-100',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-lg ${variantClasses[variant]}`}>
      <AlertCircle className='h-5 w-5 shrink-0 mt-0.5' />
      <div className='flex-1 text-sm'>{children}</div>
    </div>
  );
}
