import {
  Dropdown,
  Avatar,
  Card,
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
import { useIntl } from 'react-intl';
import { useLocale } from '../lib/useLocale';
import { localeLabels, localeSymbols, supportedLocales } from '../lib/locale';
import { NotificationCenter } from './NotificationCenter';
import type { Key } from 'react';

type SupportedLocale = (typeof supportedLocales)[number];

function Navbar() {
  const navigate = useNavigate();
  const user = useAtomValue(authUserAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const [theme, setTheme] = useAtom(themeModeAtom);
  const { logout } = useAuthActions();
  const intl = useIntl();
  const { locale, setLocale } = useLocale();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleUserAction = async (key: Key) => {
    if (key === 'logout') {
      await handleLogout();
    }
  };

  const handleLocaleChange = (key: Key | null) => {
    if (key === 'en' || key === 'id') {
      setLocale(key);
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev: boolean) => !prev);

  const toggleTheme = () =>
    setTheme((prev: 'light' | 'dark') => (prev === 'dark' ? 'light' : 'dark'));

  const userInitials = user?.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
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
              <p className="text-lg font-bold">
                {intl.formatMessage({ id: 'nav.warehouse_epr', defaultMessage: 'Warehouse ERP' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select
                selectedKey={locale}
                onSelectionChange={handleLocaleChange}
                variant="secondary"
                aria-label={intl.formatMessage({ id: 'nav.language', defaultMessage: 'Language' })}
              >
                <Select.Trigger>
                  <Select.Value>{localeSymbols[locale]}</Select.Value>
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

              <NotificationCenter />

              <Button
                isIconOnly
                variant="ghost"
                onPress={toggleTheme}
                aria-label={intl.formatMessage({ id: 'nav.theme', defaultMessage: 'Theme' })}
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
                          <Label>
                            {intl.formatMessage({ id: 'nav.signed_in_as', defaultMessage: 'Signed in as' })}
                          </Label>
                          <span className="font-semibold text-foreground">{user.name}</span>
                        </div>
                      </Dropdown.Item>
                      <Dropdown.Item id="role" textValue="role">
                        <Label>Role: {user.roleName}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="email" textValue="email">
                        <Label>{user.email}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="settings" textValue="settings">
                        <Label>{intl.formatMessage({ id: 'nav.my_settings', defaultMessage: 'My Settings' })}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="team_settings" textValue="team settings">
                        <Label>{intl.formatMessage({ id: 'nav.team_settings', defaultMessage: 'Team Settings' })}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="analytics" textValue="analytics">
                        <Label>{intl.formatMessage({ id: 'nav.analytics', defaultMessage: 'Analytics' })}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="system" textValue="system">
                        <Label>{intl.formatMessage({ id: 'nav.system', defaultMessage: 'System' })}</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="configurations" textValue="configurations">
                        <Label>
                          {intl.formatMessage({ id: 'nav.configurations', defaultMessage: 'Configurations' })}
                        </Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="help_and_feedback" textValue="help and feedback">
                        <Label>
                          {intl.formatMessage({ id: 'nav.help_and_feedback', defaultMessage: 'Help & Feedback' })}
                        </Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="logout" textValue="logout" variant="danger">
                        <Label>{intl.formatMessage({ id: 'nav.logout', defaultMessage: 'Log Out' })}</Label>
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
  );
}

export { Navbar };
