import { useLocation, useNavigate } from "react-router";
import { useAtomValue } from "jotai";
import { hasPermissionAtom } from "../lib/atoms";
import { useIsDesktop } from "../lib/useIsDesktop";
import { Accordion, Button, Card } from "@heroui/react";
import { useIntl } from 'react-intl';
import { NAV_MENU, type NavMenuItem } from "../constants/nav-menu";
import { NAV_ICON_REGISTRY } from "../assets/NavIcons";
import { CloseCircleIcon } from "../assets/IconRegistry";
import type { ReactNode } from "react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const normalizePath = (path: string) => {
        if (path.length > 1 && path.endsWith('/')) {
            return path.slice(0, -1);
        }

        return path;
    };

    const isPathActive = (href: string) => {
        const currentPath = normalizePath(location.pathname);
        const targetPath = normalizePath(href);

        if (targetPath === '/') {
            return currentPath === '/';
        }

        return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    };


    const handleNavigate = (href: string) => {
        navigate(href);
    };

    const renderIcon = (icon: string) => {
        const NavIcon = NAV_ICON_REGISTRY[icon];
        if (NavIcon) {
            return (
                <span style={{ display: 'inline-flex', width: 32, height: 32, flexShrink: 0 }}>
                    <NavIcon size={32} style={{ width: 32, height: 32 }} />
                </span>
            );
        }

        return null;
    };

    const hasPermission = useAtomValue(hasPermissionAtom);
    const isDesktop = useIsDesktop();

    const filterByPermission = (items: NavMenuItem[]): NavMenuItem[] => {
        const filtered: Array<NavMenuItem | undefined> = items
            .map((item) => {
                const children = item.children ? filterByPermission(item.children) : undefined;
                const visibleChildren = children?.length ? children : undefined;
                const itemAllowed = !item.permission || hasPermission(item.permission);

                if (!itemAllowed && !visibleChildren) {
                    return undefined;
                }

                return {
                    ...item,
                    children: visibleChildren,
                };
            });

        return filtered.filter((item: NavMenuItem | undefined): item is NavMenuItem => item !== undefined);
    };

    const visibleItems = filterByPermission(NAV_MENU);
    const intl = useIntl();

    const getMenuLabel = (name: string) => intl.formatMessage({ id: name, defaultMessage: name });

    const menuHeading = intl.formatMessage({ id: 'nav_menu', defaultMessage: 'Menu' });

    const renderMenuItem = (item: NavMenuItem, parentKey: string): ReactNode => {
        const itemKey = `${parentKey}/${item.name}`;
        const active = Boolean(item.href && isPathActive(item.href));

        if (item.children?.length) {
            return (
                <Accordion key={itemKey} variant="surface" hideSeparator>
                    <Accordion.Item key={itemKey} id={itemKey}>
                        <Accordion.Heading>
                            <Accordion.Trigger className="gap-2 py-2 pl-3.5">
                                {renderIcon(item.icon || '')}
                                {getMenuLabel(item.name)}
                                <Accordion.Indicator />
                            </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                            <Accordion.Body>
                                <div className="space-y-1 border-l pl-2">
                                    {item.children.map((child) => renderMenuItem(child, itemKey))}
                                </div>
                            </Accordion.Body>
                        </Accordion.Panel>
                    </Accordion.Item>
                </Accordion>
            );
        }

        if (item.href) {
            return (
                <Button
                    key={itemKey}
                    variant="ghost"
                    fullWidth
                    onPress={() => handleNavigate(item.href!)}
                    className={`justify-start gap-2 ${active ? "font-semibold text-accent" : ""}`}
                    style={active ? {
                        ["--button-bg" as string]: "color-mix(in oklch, var(--accent) 10%, transparent)",
                        ["--button-bg-hover" as string]: "color-mix(in oklch, var(--accent) 14%, transparent)",
                    } : undefined}
                >
                    {renderIcon(item.icon || '')}
                    {getMenuLabel(item.name)}
                </Button>
            );
        }

        return (
            <div key={itemKey} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                {renderIcon(item.icon || '')}
                <span>{getMenuLabel(item.name)}</span>
            </div>
        );
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && !isDesktop && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    aria-hidden="true"
                    onClick={onClose}
                />
            )}

            {/* Sidebar — single instance per viewport to avoid duplicate SVG gradient IDs */}
            {isDesktop ? (
                <aside
                    className={`hidden h-full shrink-0 overflow-hidden transition-[width,padding] duration-300 ease-in-out lg:block ${isOpen ? "w-72 pl-4 py-4" : "w-0 p-0"
                        }`}
                    aria-hidden={!isOpen}
                >
                    <div className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${isOpen
                        ? "opacity-100"
                        : "invisible pointer-events-none opacity-0"
                        }`}>
                        <Card className="h-full">
                            <Card.Header>
                                <span className="text-lg font-bold">{menuHeading}</span>
                            </Card.Header>
                            <Card.Content className="min-h-0 overflow-hidden">
                                <nav className="flex-1 space-y-1 overflow-y-auto">
                                    {visibleItems.map((item) => renderMenuItem(item, "root"))}
                                </nav>
                            </Card.Content>
                        </Card>
                    </div>
                </aside>
            ) : isOpen ? (
                <aside
                    className="fixed left-0 top-0 z-40 h-screen w-72 transform bg-transparent px-4 pb-4 pt-2 transition-transform duration-300 ease-in-out lg:hidden translate-x-0"
                >
                    <div className="flex h-full flex-col overflow-hidden">
                        <Card className="h-full">
                            <Card.Header>
                                <div className="flex w-full items-center justify-between gap-3 border-b border-gray-200 pb-3 dark:border-gray-800">
                                    <span className="text-lg font-bold">{menuHeading}</span>
                                    <Button isIconOnly variant="ghost" aria-label="Close sidebar" onPress={onClose}>
                                        <CloseCircleIcon size={20} />
                                    </Button>
                                </div>
                            </Card.Header>
                            <Card.Content className="min-h-0 overflow-hidden">
                                <nav className="flex-1 space-y-1 overflow-y-auto">
                                    {visibleItems.map((item) => renderMenuItem(item, "root"))}
                                </nav>
                            </Card.Content>
                        </Card>
                    </div>
                </aside>
            ) : null}
        </>
    );
}

export { Sidebar };
