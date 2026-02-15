import { Chip, Modal, Button, Card } from '@heroui/react';

import { useResourceLock } from '@/hooks/use-resource-lock';

interface ResourceLockIndicatorProps {
  resourceType: string;
  resourceId: number;
  /**
   * Display mode:
   * - 'badge': Small chip indicator
   * - 'inline': Inline text
   * - 'detailed': Detailed card view
   * - 'alert': Alert banner (hidden if no lock)
   * - 'modal': Blocking modal (shown only if locked by others)
   * @default 'badge'
   */
  mode?: 'badge' | 'inline' | 'detailed' | 'alert' | 'modal';

  /**
   * Show loading state
   * @default false
   */
  showLoading?: boolean;

  /**
   * Callback when back button is clicked (modal mode)
   */
  onBack?: () => void;

  /**
   * Auto-refresh when lock is released (modal mode)
   * @default true
   */
  autoRefreshOnRelease?: boolean;
}

/**
 * Component to display resource lock status
 *
 * @example
 * ```tsx
 * // Badge mode (for list views)
 * <ResourceLockIndicator resourceType="department" resourceId={5} mode="badge" />
 *
 * // Alert mode (for detail views - hidden if no lock)
 * <ResourceLockIndicator resourceType="department" resourceId={5} mode="alert" />
 *
 * // Modal mode (for edit/update views - blocks if locked by others)
 * <ResourceLockIndicator
 *   resourceType="department"
 *   resourceId={5}
 *   mode="modal"
 *   onBack={() => navigate('/departments')}
 * />
 * ```
 */
export function ResourceLockIndicator({
  resourceType,
  resourceId,
  mode = 'badge',
  showLoading = false,
  onBack,
  autoRefreshOnRelease = true,
}: ResourceLockIndicatorProps) {
  const {
    isLocked,
    lockedBy,
    lock,
    loading,
    isOwnedByMe,
    viewers,
    viewersCount,
  } = useResourceLock(resourceType, resourceId, {
    autoAcquire: false,
    autoRelease: false,
    onLockReleased: () => {
      // Auto-refresh when lock is released (for modal mode)
      if (mode === 'modal' && autoRefreshOnRelease) {
        window.location.reload();
      }
    },
  });

  if (loading && showLoading) {
    return (
      <Chip color='default' size='sm'>
        Checking...
      </Chip>
    );
  }

  // For alert and modal modes: hide if not locked or if owned by current user
  if (mode === 'alert' || mode === 'modal') {
    if (!isLocked || isOwnedByMe) {
      return null; // Don't show anything if available or owned by me
    }
  }

  if (!isLocked) {
    if (mode === 'badge') {
      return (
        <Chip color='success' size='sm'>
          Available
        </Chip>
      );
    }

    if (mode === 'inline') {
      return <span className='text-success text-sm'>✓ Available</span>;
    }

    return (
      <div className='flex items-center gap-2 text-sm'>
        <span className='inline-block w-2 h-2 rounded-full bg-success' />
        <span className='text-success'>Available for editing</span>
      </div>
    );
  }

  // Resource is locked
  const expiresAt = lock?.expiresAt ? new Date(lock.expiresAt) : null;
  const timeRemaining = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60))
    : null;

  if (mode === 'badge') {
    return (
      <Chip color='warning' size='sm'>
        🔒 {lockedBy}
      </Chip>
    );
  }

  if (mode === 'inline') {
    return (
      <span className='text-warning text-sm'>🔒 Locked by {lockedBy}</span>
    );
  }

  // Alert mode - for detail views (shows warning but doesn't block)
  if (mode === 'alert') {
    return (
      <Card className='mb-4 border-warning-200 dark:border-warning-200/20 bg-warning-50 dark:bg-warning-100/10'>
        <div className='card__content'>
          <div className='flex items-start gap-3'>
            <span className='text-warning text-xl mt-0.5'>⚠️</span>
            <div className='flex-1'>
              <h4 className='text-sm font-semibold text-warning-700 dark:text-warning mb-1'>
                Resource is Locked
              </h4>
              <p className='text-sm text-warning-600 dark:text-warning-400'>
                This {resourceType} is currently being edited by{' '}
                <strong>{lockedBy}</strong>.
                {timeRemaining !== null && (
                  <>
                    {' '}
                    The lock will expire in {timeRemaining} minute
                    {timeRemaining !== 1 ? 's' : ''}.
                  </>
                )}
              </p>
              {viewersCount > 0 && (
                <p className='text-xs text-warning-500 mt-2'>
                  {viewersCount} viewer{viewersCount !== 1 ? 's' : ''} online
                  {viewers?.length > 0 && (
                    <span className='block mt-1 text-xs text-muted'>
                      {viewers.map((v: any) => v.name || v.id).join(', ')}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Modal mode - for edit/update views (blocks all activity)
  if (mode === 'modal') {
    return (
      <Modal>
        <Modal.Backdrop
          isOpen={isLocked && !isOwnedByMe}
          onOpenChange={() => {}}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header className='flex flex-col gap-1'>
                <span className='text-warning text-2xl'>🔒</span>
                <h3 className='text-lg font-semibold'>
                  Resource is Being Edited
                </h3>
              </Modal.Header>
              <Modal.Body>
                <div className='space-y-3'>
                  <p className='text-default-600'>
                    This {resourceType} is currently being edited by:
                  </p>
                  <div className='p-3 bg-warning-50 dark:bg-warning-100/10 rounded-lg border border-warning-200 dark:border-warning-200/20'>
                    <p className='font-semibold text-warning-700 dark:text-warning'>
                      {lockedBy}
                    </p>
                    {timeRemaining !== null && (
                      <p className='text-sm text-warning-600 dark:text-warning-400 mt-1'>
                        Lock expires in {timeRemaining} minute
                        {timeRemaining !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  {viewersCount > 0 && (
                    <div className='mt-3 text-xs text-muted'>
                      <p className='font-semibold text-muted'>
                        {viewersCount} viewer{viewersCount !== 1 ? 's' : ''}{' '}
                        online
                      </p>
                      <p className='mt-1'>
                        {viewers.map((v: any) => v.name || v.id).join(', ')}
                      </p>
                    </div>
                  )}
                  <p className='text-sm text-default-500'>
                    You cannot edit this resource until {lockedBy} finishes or
                    the lock expires. The page will automatically refresh when
                    the lock is released.
                  </p>
                </div>
              </Modal.Body>
              <Modal.Footer>
                {onBack && (
                  <Button variant='outline' onPress={onBack}>
                    Go Back
                  </Button>
                )}
                <Button
                  variant='ghost'
                  onPress={() => window.location.reload()}>
                  Refresh
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  // Detailed mode - original detailed view
  return (
    <div className='flex items-start gap-2 p-3 bg-warning-50 dark:bg-warning-100/10 rounded-lg border border-warning-200 dark:border-warning-200/20'>
      <span className='text-warning text-lg'>🔒</span>
      <div className='flex-1'>
        <p className='text-sm font-medium text-warning-700 dark:text-warning'>
          Currently being edited by {lockedBy}
        </p>
        {timeRemaining !== null && (
          <p className='text-xs text-warning-600 dark:text-warning-400 mt-1'>
            Lock expires in {timeRemaining} minute
            {timeRemaining !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
