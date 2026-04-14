import { useState } from 'react';
import {
  Dropdown,
  Avatar,
  Spinner,
  Card,
  Drawer,
  Button,
} from '@heroui/react';
import { useSetAtom, useAtomValue, useAtom } from 'jotai';
import { authUserAtom, sidebarOpenAtom, themeModeAtom } from '../lib/atoms';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useAuthActions } from '../lib/useAuth';
import { trpcClient } from '../lib/trpc';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { useLocale } from '../lib/useLocale';
import type { Key } from 'react';

const notificationTypeIconMap: Record<string, string> = {
  INFO: 'solar:info-circle-linear',
  SUCCESS: 'solar:check-circle-linear',
  WARNING: 'solar:danger-triangle-linear',
  ERROR: 'solar:close-circle-linear',
};

const notificationTypeColorMap: Record<string, string> = {
  INFO: 'text-blue-500',
  SUCCESS: 'text-green-500',
  WARNING: 'text-yellow-500',
  ERROR: 'text-red-500',
};

const notificationTargetIconMap: Record<string, string> = {
  SYSTEM: 'solar:settings-linear',
  INBOUND: 'solar:download-linear',
  OUTBOUND: 'solar:upload-linear',
  FOUND: 'solar:box-search-linear',
  LOSS: 'solar:shield-alert-linear',
  TRANSFER: 'solar:arrow-right-linear',
};

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAtomValue(authUserAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const [theme, setTheme] = useAtom(themeModeAtom);
  const { logout } = useAuthActions();
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();
  const intl = useIntl();
  const { locale, setLocale } = useLocale();

  // Fetch notifications
  const { data: notifsData, isLoading: isLoadingNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => trpcClient.notification.list.query({ limit: 10, unreadOnly: false }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notificationUnreadCount'],
    queryFn: () => trpcClient.notification.unreadCount.query(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const notifications = (notifsData?.data ?? []) as any[];
  const unreadCount = unreadData?.count ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleUserAction = async (key: Key) => {
    if (key === 'logout') {
      await handleLogout();
      return;
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const handleMarkAsRead = async (id: string) => {
    try {
      await trpcClient.notification.markAsRead.mutate({ id });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await trpcClient.notification.markAllAsRead.mutate();
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <>
      <Card className="md:mx-4 md:mt-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Toggle sidebar"
            >
              <Icon icon="solar:hamburger-menu-linear" className="h-5 w-5" />
            </button>
            <p className="text-lg font-bold">{intl.formatMessage({ id: 'nav.warehouseEPR', defaultMessage: 'Warehouse ERP' })}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'id')}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-100"
              aria-label={intl.formatMessage({ id: 'nav.language', defaultMessage: 'Language' })}
            >
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
            <button
              onClick={() => setNotifOpen(true)}
              className="relative inline-flex items-center justify-center rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={intl.formatMessage({ id: 'nav.notifications', defaultMessage: 'Notifications' })}
            >
              <Icon icon="solar:bell-linear" className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dark / light mode toggle */}
            <button
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={intl.formatMessage({ id: 'nav.theme', defaultMessage: 'Theme' })}
            >
              <Icon
                icon={theme === 'dark' ? 'solar:sun-2-linear' : 'solar:moon-linear'}
                className="h-5 w-5"
              />
            </button>

            {user ? (
              <Dropdown>
                <Dropdown.Trigger className="ml-1 flex items-center text-left">
                  <Avatar
                    size="sm"
                    className="cursor-pointer transition-transform"
                  />
                  <div className="hidden md:flex md:flex-col md:ml-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.roleName}
                    </p>
                  </div>
                </Dropdown.Trigger>

                <Dropdown.Popover>
                  <Dropdown.Menu aria-label="User Actions" onAction={handleUserAction}>
                    <Dropdown.Item id="profile" textValue="profile" className="h-14 gap-2">
                      <p className="font-semibold">Signed in as</p>
                      <p className="font-semibold">{user.name}</p>
                    </Dropdown.Item>
                    <Dropdown.Item id="role" textValue="role">
                      Role: {user.roleName}
                    </Dropdown.Item>
                    <Dropdown.Item id="email" textValue="email">
                      {user.email}
                    </Dropdown.Item>
                    <Dropdown.Item id="settings" textValue="settings">My Settings</Dropdown.Item>
                    <Dropdown.Item id="team_settings" textValue="team settings">Team Settings</Dropdown.Item>
                    <Dropdown.Item id="analytics" textValue="analytics">Analytics</Dropdown.Item>
                    <Dropdown.Item id="system" textValue="system">System</Dropdown.Item>
                    <Dropdown.Item id="configurations" textValue="configurations">Configurations</Dropdown.Item>
                    <Dropdown.Item id="help_and_feedback" textValue="help and feedback">Help & Feedback</Dropdown.Item>
                    <Dropdown.Item id="logout" textValue="logout" variant="danger">
                      Log Out
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            ) : null}
          </div>
        </div>
      </Card>

      <Drawer>
        <Drawer.Backdrop
          isOpen={notifOpen}
          onOpenChange={setNotifOpen}
          variant="opaque"
        >
          <Drawer.Content placement="right">
            <Drawer.Dialog
              aria-label={intl.formatMessage({ id: 'nav.notificationPanel', defaultMessage: 'Notifications panel' })}
              className="w-88 max-w-[92vw] bg-surface"
            >
              <Drawer.Handle className="md:hidden" />

              <Drawer.Header className="flex items-center justify-between px-5 pb-2 pt-4">
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
              </Drawer.Header>

              <Drawer.Body className="px-3 pb-2 pt-1">
                {isLoadingNotifs ? (
                  <div className="flex h-full min-h-40 items-center justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 py-10">
                    <Icon icon="solar:bell-off-linear" className="size-7 text-muted" />
                    <p className="text-sm text-muted">
                      {intl.formatMessage({ id: 'nav.noNotifications', defaultMessage: 'No notifications' })}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 overflow-y-auto">
                    {notifications.map((item) => {
                      const colorClass = notificationTypeColorMap[item.type] || 'text-blue-500';
                      const iconName = notificationTargetIconMap[item.targetType] || notificationTypeIconMap[item.type];
                      return (
                        <div
                          key={item.id}
                          onClick={() => item.actionUrl && navigate(item.actionUrl)}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${item.isRead
                            ? 'bg-transparent'
                            : 'bg-default/50'
                            } hover:bg-default`}
                        >
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass} bg-default`}>
                            <Icon icon={iconName} className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                              {!item.isRead && (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleMarkAsRead(item.id);
                                  }}
                                  className="shrink-0 text-[11px] font-medium text-accent hover:text-accent/80"
                                >
                                  Mark
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
              </Drawer.Body>

              <Drawer.Footer className="px-4 pb-4 pt-2">
                {unreadCount > 0 ? (
                  <Button variant="ghost" className="w-full" onPress={handleMarkAllAsRead}>
                    Mark all as read
                  </Button>
                ) : null}
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
