import {
  Dropdown,
  Avatar,
  Card,
  Button,
  Select,
  ListBox,
  Label,
} from "@heroui/react";
import { useAtomValue, useSetAtom } from "jotai";
import { authUserAtom, sidebarOpenAtom, themeModeAtom } from "../lib/atoms";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
import { useAuthActions } from "../lib/useAuth";
import { useIntl } from "react-intl";
import { useLocale } from "../lib/useLocale";
import { localeLabels, localeSymbols, supportedLocales } from "../lib/i18n";
import { NotificationCenter } from "./NotificationCenter";
import { ApiWaitIndicator } from "./ApiWaitIndicator";
import { ScanDialog } from "./ScanDialog";
import { hasPermissionAtom } from "../lib/atoms";
import { useState } from "react";
import type { Key } from "react";

type SupportedLocale = (typeof supportedLocales)[number];

function Navbar() {
  const navigate = useNavigate();
  const user = useAtomValue(authUserAtom);
  const hasPermission = useAtomValue(hasPermissionAtom);
  const setSidebarOpen = useSetAtom(sidebarOpenAtom);
  const setTheme = useSetAtom(themeModeAtom);
  const { logout } = useAuthActions();
  const intl = useIntl();
  const { locale, setLocale } = useLocale();
  const [scanOpen, setScanOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Only destinations that exist as real routes. Anything not listed here is a
  // dead control — no placeholder items in the user menu.
  const USER_ACTION_ROUTES: Record<string, string> = {
    settings: "/settings",
    activity_logs: "/activity-logs",
    analytics: "/reports/charts",
  };

  const handleUserAction = async (key: Key) => {
    if (key === "logout") {
      await handleLogout();
      return;
    }
    const href = USER_ACTION_ROUTES[String(key)];
    if (href) navigate(href);
  };

  const handleLocaleChange = (key: Key | null) => {
    if (key === "en" || key === "id") {
      setLocale(key);
    }
  };

  const toggleSidebar = () => setSidebarOpen((prev: boolean) => !prev);

  const toggleTheme = () =>
    setTheme((prev: "light" | "dark") => (prev === "dark" ? "light" : "dark"));

  const userInitials = user?.name
    .split(" ")
    .map((s) => s[0])
    .join("")
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
                {intl.formatMessage({
                  id: "nav.warehouse_epr",
                  defaultMessage: "Warehouse ERP",
                })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ApiWaitIndicator />

              {hasPermission("pallet@read") ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={() => setScanOpen(true)}
                  aria-label={intl.formatMessage({
                    id: "nav.scan",
                    defaultMessage: "Scan pallet",
                  })}
                >
                  <Icon icon="solar:scan-barcode-linear" className="h-5 w-5" />
                </Button>
              ) : null}

              <Select
                selectedKey={locale}
                onSelectionChange={handleLocaleChange}
                variant="secondary"
                aria-label={intl.formatMessage({
                  id: "nav.language",
                  defaultMessage: "Language",
                })}
              >
                <Select.Trigger>
                  <Select.Value>{localeSymbols[locale]}</Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {supportedLocales.map((code: SupportedLocale) => (
                      <ListBox.Item
                        key={code}
                        id={code}
                        textValue={localeLabels[code]}
                      >
                        <span className="font-semibold">
                          {localeSymbols[code]}
                        </span>
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
                aria-label={intl.formatMessage({
                  id: "nav.theme",
                  defaultMessage: "Theme",
                })}
              >
                <Icon icon="solar:sun-linear" className="h-5 w-5" />
              </Button>

              {user ? (
                <Dropdown>
                  <Dropdown.Trigger>
                    <div
                      className="ml-1 flex items-center text-left"
                      aria-label="User menu"
                    >
                      <Avatar size="sm">
                        <Avatar.Fallback>{userInitials}</Avatar.Fallback>
                      </Avatar>
                      <div className="ml-3 hidden md:flex md:flex-col">
                        <p className="text-sm font-semibold text-foreground">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted">{user.roleName}</p>
                      </div>
                    </div>
                  </Dropdown.Trigger>

                  <Dropdown.Popover>
                    {/* Identity block — informational, not an action. */}
                    <div className="flex flex-col gap-1 px-3 pt-1 pb-2">
                      <p className="text-sm font-semibold text-foreground">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted">
                        {intl.formatMessage({
                          id: "nav.signed_in_as",
                          defaultMessage: "Signed in as",
                        })}{" "}
                        <span className="font-medium text-foreground">
                          {user.roleName}
                        </span>
                      </p>
                      <p className="text-xs text-muted">{user.email}</p>
                    </div>

                    <Dropdown.Menu
                      aria-label="User Actions"
                      onAction={handleUserAction}
                    >
                      {hasPermission("settings@read") ? (
                        <Dropdown.Item id="settings" textValue="settings">
                          <Icon
                            icon="solar:settings-linear"
                            className="size-4 shrink-0 text-muted"
                          />
                          <Label>
                            {intl.formatMessage({
                              id: "nav.my_settings",
                              defaultMessage: "My Settings",
                            })}
                          </Label>
                        </Dropdown.Item>
                      ) : null}
                      {hasPermission("activity_log@read") ? (
                        <Dropdown.Item
                          id="activity_logs"
                          textValue="activity logs"
                        >
                          <Icon
                            icon="solar:clock-circle-linear"
                            className="size-4 shrink-0 text-muted"
                          />
                          <Label>
                            {intl.formatMessage({
                              id: "nav.activity_logs",
                              defaultMessage: "Activity Logs",
                            })}
                          </Label>
                        </Dropdown.Item>
                      ) : null}
                      {hasPermission("stock-movement@read") ? (
                        <Dropdown.Item id="analytics" textValue="analytics">
                          <Icon
                            icon="solar:chart-2-linear"
                            className="size-4 shrink-0 text-muted"
                          />
                          <Label>
                            {intl.formatMessage({
                              id: "nav.analytics",
                              defaultMessage: "Analytics",
                            })}
                          </Label>
                        </Dropdown.Item>
                      ) : null}
                      <Dropdown.Item
                        id="logout"
                        textValue="logout"
                        variant="danger"
                      >
                        <Icon
                          icon="solar:logout-square-linear"
                          className="size-4 shrink-0 text-danger"
                        />
                        <Label>
                          {intl.formatMessage({
                            id: "nav.logout",
                            defaultMessage: "Log Out",
                          })}
                        </Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null}
            </div>
          </div>
        </Card.Content>
      </Card>
      <ScanDialog isOpen={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
}

export { Navbar };
