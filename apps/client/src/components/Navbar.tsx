import { useState } from 'react';
import {
  Dropdown,
  Avatar,
  Spinner,
  Card,
  Drawer,
  Button,
  Select,
  ListBox,
  Label,
} from '@heroui/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { authUserAtom, sidebarOpenAtom, themeModeAtom } from '../lib/atoms';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useAuthActions } from '../lib/useAuth';
import { trpcClient } from '../lib/trpc';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { useLocale } from '../lib/useLocale';
import { localeLabels, localeSymbols, supportedLocales } from '../lib/locale';
import type { Key } from 'react';

type SupportedLocale = (typeof supportedLocales)[number];

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

function Navbar() {
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

  const notifications: NotificationItem[] = notifsData?.data ?? [];
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

  const handleLocaleChange = (key: Key | null) => {
    if (key === 'en' || key === 'id') {
      setLocale(key);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev: boolean) => !prev);
  };

  const toggleTheme = () => setTheme((prev: 'light' | 'dark') => (prev === 'dark' ? 'light' : 'dark'));

  const userInitials = user?.name
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
      <div className="md:mx-4 md:mt-4">
        <Card>
          <Card.Content>
            <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="ghost"
              onPress={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Icon icon="solar:hamburger-menu-linear" className="h-5 w-5" />
            </Button>
            <p className="text-lg font-bold">{intl.formatMessage({ id: 'nav_warehouseepr', defaultMessage: 'Warehouse ERP' })}</p>
          </div>

          <div className="flex items-center gap-2">
            <Select
              selectedKey={locale}
              onSelectionChange={handleLocaleChange}
              variant="secondary"
              aria-label={intl.formatMessage({ id: 'nav.locale', defaultMessage: 'Language' })}
            >
              <Select.Trigger>
                <Select.Value>
                  {localeSymbols[locale]}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {supportedLocales.map((code: SupportedLocale) => (
                    <ListBox.Item key={code} id={code} textValue={localeLabels[code]}>
                      <span className="font-semibold">{localeSymbols[code]}</span>
                      <Label>{localeLabels[code]}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <div className="relative">
              <Button
                isIconOnly
                variant="ghost"
                onPress={() => setNotifOpen(true)}
                aria-label={intl.formatMessage({ id: 'nav_notifications', defaultMessage: 'Notifications' })}
              >
                <Icon icon="solar:bell-linear" className="h-5 w-5" />
              </Button>
              {unreadCount > 0 && (
                <span className="pointer-events-none absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            <Button
              isIconOnly
              variant="ghost"
              onPress={toggleTheme}
              aria-label={intl.formatMessage({ id: 'nav_theme', defaultMessage: 'Theme' })}
            >
              <Icon
                icon={theme === 'dark' ? 'solar:sun-2-linear' : 'solar:moon-linear'}
                className="h-5 w-5"
              />
            </Button>

            {user ? (
              <Dropdown>
                <Dropdown.Trigger>
                  <div className="ml-1 flex items-center text-left" aria-label="User menu">
                    <Avatar size="sm">
                      <Avatar.Fallback>{userInitials}</Avatar.Fallback>
                    </Avatar>
                    <div className="ml-3 hidden md:flex md:flex-col">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.roleName}
                      </p>
                    </div>
                  </div>
                </Dropdown.Trigger>

                <Dropdown.Popover>
                  <Dropdown.Menu aria-label="User Actions" onAction={handleUserAction}>
                    <Dropdown.Item id="profile" textValue="profile">
                      <div className="flex flex-col gap-1 py-1">
                        <Label>Signed in as</Label>
                        <span className="font-semibold text-foreground">{user.name}</span>
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="role" textValue="role">
                      <Label>Role: {user.roleName}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="email" textValue="email">
                      <Label>{user.email}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="settings" textValue="settings"><Label>My Settings</Label></Dropdown.Item>
                    <Dropdown.Item id="team_settings" textValue="team settings"><Label>Team Settings</Label></Dropdown.Item>
                    <Dropdown.Item id="analytics" textValue="analytics"><Label>Analytics</Label></Dropdown.Item>
                    <Dropdown.Item id="system" textValue="system"><Label>System</Label></Dropdown.Item>
                    <Dropdown.Item id="configurations" textValue="configurations"><Label>Configurations</Label></Dropdown.Item>
                    <Dropdown.Item id="help_and_feedback" textValue="help and feedback"><Label>Help & Feedback</Label></Dropdown.Item>
                    <Dropdown.Item id="logout" textValue="logout" variant="danger">
                      <Label>Log Out</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            ) : null}
          </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      <Drawer>
        <Drawer.Backdrop
          isOpen={notifOpen}
          onOpenChange={setNotifOpen}
          variant="opaque"
          aria-label={intl.formatMessage({ id: 'nav_notification_close', defaultMessage: 'Close notifications' })}
        >
          <Drawer.Content placement="right">
            <Drawer.Dialog
              aria-label={intl.formatMessage({ id: 'nav_notificationpanel', defaultMessage: 'Notifications panel' })}
              className="w-88 max-w-[92vw] bg-surface"
            >
              <Drawer.Handle className="md:hidden" />

              <Drawer.Header>
                <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:bell-linear" className="size-5 text-foreground" />
                  <Drawer.Heading className="text-base font-semibold text-foreground">
                    {intl.formatMessage({ id: 'nav_notifications', defaultMessage: 'Notifications' })}
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
                {isLoadingNotifs ? (
                  <div className="flex h-full min-h-40 items-center justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 py-10">
                    <Icon icon="solar:bell-off-linear" className="size-7 text-muted" />
                    <p className="text-sm text-muted">
                      {intl.formatMessage({ id: 'nav_nonotifications', defaultMessage: 'No notifications' })}
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
                </div>
              </Drawer.Body>

              <Drawer.Footer>
                <div className="px-4 pb-4 pt-2">
                {unreadCount > 0 ? (
                  <Button variant="ghost" fullWidth onPress={handleMarkAllAsRead}>
                    Mark all as read
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

export { Navbar };
