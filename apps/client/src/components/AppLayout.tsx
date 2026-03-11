import { useMemo, useState } from "react";
import { Avatar, Button, Card, ScrollShadow, Separator } from "@heroui/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import ThemeToggle from "./ThemeToggle";
import { ERP_MENU_ITEMS } from "#/lib/menu";
import { buildVisibleMenu } from "#/lib/permission";

type AppLayoutProps = {
  userName: string;
  roleName: string;
  permissions: string[];
  onLogout: () => void;
  isLoggingOut?: boolean;
  children: React.ReactNode;
};

export function AppLayout({
  userName,
  roleName,
  permissions,
  onLogout,
  isLoggingOut = false,
  children,
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const visibleMenus = useMemo(
    () => buildVisibleMenu(ERP_MENU_ITEMS, permissions),
    [permissions],
  );

  const navItems = visibleMenus.filter((item) => item.to);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-8xl flex-col gap-4 p-3 md:p-4 bg-background">
      <Card className="rounded-2xl border border-default-200/80 px-4 py-3 backdrop-blur-md md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 md:gap-3">
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsSidebarOpen((prev) => !prev)}
              className="md:hidden"
              aria-label="Toggle sidebar"
            >
              Menu
            </Button>

            <Avatar size="sm" className="bg-primary text-primary-foreground">
              EW
            </Avatar>

            <div className="grid gap-0.5">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-default-500">
                  ERP Warehouse
                </p>
              </div>
              <h1 className="text-base font-semibold tracking-tight text-default-900 md:text-[1.05rem] ">
                Operations Console
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Card className="rounded-xl border border-default-200/70 bg-default-50/75 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <Avatar size="sm" className="bg-primary/15 text-primary">
                  {userInitials || "U"}
                </Avatar>
                <div className="grid gap-0">
                  <p className="text-xs font-semibold leading-tight text-default-900 ">
                    {userName}
                  </p>
                  <p className="text-[11px] leading-tight text-default-500">
                    {roleName}
                  </p>
                </div>
              </div>
            </Card>

            <ThemeToggle />

            <Button
              variant="danger-soft"
              size="sm"
              isDisabled={isLoggingOut}
              onPress={onLogout}
              className="font-medium"
            >
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_1fr]">
        <Card
          className={`fixed inset-y-0 left-0 z-40 rounded-r-2xl border border-default-200/70 p-4 shadow-sm backdrop-blur-md transition-transform duration-200  md:static md:w-auto md:translate-x-0 md:rounded-2xl ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-default-500 ">
                  Navigation
                </p>
                <p className="text-xs text-default-400">Authorized menus</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onPress={() => setIsSidebarOpen(false)}
              >
                Close
              </Button>
            </div>

            <Separator />

            <ScrollShadow className="max-h-[calc(100vh-180px)] md:max-h-[calc(100vh-220px)]">
              <nav className="grid gap-2 pr-1" aria-label="Main navigation">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    fullWidth
                    variant={
                      pathname === item.to || pathname.startsWith(`${item.to}/`)
                        ? "primary"
                        : "outline"
                    }
                    className="h-auto justify-start rounded-xl px-3 py-2 text-left"
                    onPress={() => {
                      navigate({ to: item.to! });
                      setIsSidebarOpen(false);
                    }}
                  >
                    <div className="grid gap-0.5">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs opacity-80">{item.description}</p>
                    </div>
                  </Button>
                ))}
              </nav>
            </ScrollShadow>
          </div>
        </Card>

        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
