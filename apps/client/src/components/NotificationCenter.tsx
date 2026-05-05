import { useState } from 'react';
import { Button, Drawer, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { trpcClient } from '../lib/trpc';

interface NotificationItem {
  actionUrl: string | null;
  createdAt: Date | string;
  id: string;
  isRead: boolean;
  message: string;
  targetType: string;
  title: string;
  type: string;
}

const TYPE_ICON: Record<string, string> = {
  INFO: 'solar:info-circle-linear',
  SUCCESS: 'solar:check-circle-linear',
  WARNING: 'solar:danger-triangle-linear',
  ERROR: 'solar:close-circle-linear',
};

const TYPE_COLOR: Record<string, string> = {
  INFO: 'text-blue-500',
  SUCCESS: 'text-green-500',
  WARNING: 'text-yellow-500',
  ERROR: 'text-red-500',
};

const TARGET_ICON: Record<string, string> = {
  SYSTEM: 'solar:settings-linear',
  INBOUND: 'solar:download-linear',
  OUTBOUND: 'solar:upload-linear',
  FOUND: 'solar:box-search-linear',
  LOSS: 'solar:shield-alert-linear',
  TRANSFER: 'solar:arrow-right-linear',
};

/**
 * Self-contained notification center.
 * Renders a bell button with unread badge.
 * On open, fetches the current user's notifications and allows mark-as-read.
 */
function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const intl = useIntl();

  const { data: unreadData } = useQuery({
    queryKey: ['notificationUnreadCount'],
    queryFn: () => trpcClient.notification.unreadCount.query(),
    staleTime: 30_000,
  });

  const { data: notifsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => trpcClient.notification.list.query({ limit: 20, unreadOnly: false }),
    enabled: isOpen,
    staleTime: 0,
  });

  const unreadCount = unreadData?.count ?? 0;
  const notifications: NotificationItem[] = notifsData?.data ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] }),
    ]);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await trpcClient.notification.markAsRead.mutate({ id });
      await invalidate();
    } catch {
      // silent
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await trpcClient.notification.markAllAsRead.mutate();
      await invalidate();
    } catch {
      // silent
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          isIconOnly
          variant="ghost"
          onPress={() => setIsOpen(true)}
          aria-label={intl.formatMessage({ id: 'nav.notifications', defaultMessage: 'Notifications' })}
        >
          <Icon icon="solar:bell-linear" className="h-5 w-5" />
        </Button>
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      <Drawer>
        <Drawer.Backdrop
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          variant="opaque"
          aria-label={intl.formatMessage({ id: 'nav.close_notifications', defaultMessage: 'Close notifications' })}
        >
          <Drawer.Content placement="right">
            <Drawer.Dialog
              aria-label={intl.formatMessage({ id: 'nav.notification_panel', defaultMessage: 'Notifications panel' })}
              className="w-88 max-w-[92vw] bg-surface"
            >
              <Drawer.Handle className="md:hidden" />

              <Drawer.Header>
                <div className="flex items-center justify-between px-5 pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:bell-linear" className="size-5 text-foreground" />
                    <Drawer.Heading className="text-base font-semibold text-foreground">
                      {intl.formatMessage({ id: 'nav.notifications', defaultMessage: 'Notifications' })}
                    </Drawer.Heading>
                    {unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Drawer.Header>

              <Drawer.Body>
                <div className="px-3 pb-2 pt-1">
                  {isLoading ? (
                    <div className="flex h-full min-h-40 items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 py-10">
                      <Icon icon="solar:bell-off-linear" className="size-7 text-muted" />
                      <p className="text-sm text-muted">
                        {intl.formatMessage({ id: 'nav.no_notifications', defaultMessage: 'No notifications' })}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 overflow-y-auto">
                      {notifications.map((item) => {
                        const colorClass = TYPE_COLOR[item.type] ?? 'text-blue-500';
                        const iconName = TARGET_ICON[item.targetType] ?? TYPE_ICON[item.type] ?? 'solar:info-circle-linear';
                        return (
                          <div
                            key={item.id}
                            onClick={() => item.actionUrl && navigate(item.actionUrl)}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                              item.isRead ? 'bg-transparent' : 'bg-default/50'
                            } hover:bg-default`}
                          >
                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass} bg-default`}
                            >
                              <Icon icon={iconName} className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="line-clamp-1 text-sm font-medium text-foreground">
                                  {item.title}
                                </p>
                                {!item.isRead && (
                                  <button
                                    onClick={(e) => void handleMarkAsRead(item.id, e)}
                                    className="shrink-0 text-[11px] font-medium text-accent hover:text-accent/80"
                                  >
                                    {intl.formatMessage({ id: 'notification.mark_read', defaultMessage: 'Mark' })}
                                  </button>
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.message}</p>
                              <p className="mt-1 text-xs text-muted/60">
                                {new Date(item.createdAt).toLocaleString('id-ID')}
                              </p>
                            </div>
                            {!item.isRead && (
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Drawer.Body>

              <Drawer.Footer>
                <div className="px-4 pb-4 pt-2">
                  {unreadCount > 0 ? (
                    <Button variant="ghost" fullWidth onPress={handleMarkAllAsRead}>
                      {intl.formatMessage({ id: 'notification.mark_all_read', defaultMessage: 'Mark all as read' })}
                    </Button>
                  ) : null}
                </div>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}

export { NotificationCenter };
