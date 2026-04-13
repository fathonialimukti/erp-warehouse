import { useLocation, useNavigate } from "react-router";
import { useAtomValue } from "jotai";
import { userPermissionsAtom } from "../lib/atoms";
import { Icon } from "@iconify/react";
import { Accordion, Button, Card } from "@heroui/react";
import { useIntl } from 'react-intl';
import { NAV_MENU, type NavMenuItem } from "../constants/nav-menu";
import type { ReactNode } from "react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const permissions = useAtomValue(userPermissionsAtom);
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
        const isLocalAsset = /^(\/|https?:\/\/)/.test(icon) || /\.(svg|png|jpe?g|webp|gif)$/i.test(icon);

        if (isLocalAsset) {
            return <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" aria-hidden="true" />;
        }

        return <Icon icon={icon} className="size-4 shrink-0" />;
    };

    const filterByPermission = (items: NavMenuItem[]): NavMenuItem[] => {
        return items
            .filter((item) => !item.permission || permissions.includes(item.permission))
            .map((item) => ({
                ...item,
                children: item.children ? filterByPermission(item.children) : undefined,
            }))
            .filter((item) => !item.children || item.children.length > 0 || item.href);
    };

    const visibleItems = filterByPermission(NAV_MENU);
    const intl = useIntl();

    const getMenuLabel = (name: string) => intl.formatMessage({ id: name, defaultMessage: name });

    const renderMenuItem = (item: NavMenuItem, parentKey: string): ReactNode => {
        const itemKey = `${parentKey}/${item.name}`;
        const active = Boolean(item.href && isPathActive(item.href));

        if (item.children?.length) {
            return (
                <Accordion key={itemKey} className="">
                    <Accordion.Item>
                        <Accordion.Heading className="">
                            <Accordion.Trigger className="rounded-2xl py-2">
                                {renderIcon(item.icon || "solar:question-circle-linear")}
                                <span className="ml-2">{getMenuLabel(item.name)}</span>
                                <Accordion.Indicator />
                            </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                            <Accordion.Body className="pl-3 pt-1 pr-0 pb-0 text-sm">
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
                    variant={active ? "primary" : "ghost"}
                    className="w-full justify-start"
                    onPress={() => handleNavigate(item.href!)}
                >
                    {renderIcon(item.icon || "solar:question-circle-linear")}
                    <span>{getMenuLabel(item.name)}</span>
                </Button>
            );
        }

        return (
            <div key={itemKey} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {renderIcon(item.icon || "solar:question-circle-linear")}
                <span>{getMenuLabel(item.name)}</span>
            </div>
        );
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    aria-hidden="true"
                    onClick={onClose}
                />
            )}

            {/* Mobile sidebar drawer */}
            <aside
                className={`fixed left-0 top-0 z-40 h-screen w-72 transform bg-transparent px-4 pb-4 pt-2 transition-transform duration-300 ease-in-out lg:hidden ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <Card className="flex h-full flex-col overflow-hidden">
                    {/* Sidebar header with close button on mobile */}
                    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                        <span className="font-bold text-lg">{intl.formatMessage({ id: 'nav.menu', defaultMessage: 'Menu' })}</span>
                        <button
                            className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            aria-label="Close sidebar"
                            onClick={onClose}
                        >
                            <Icon icon="solar:close-circle-linear" className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Navigation items */}
                    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                        {visibleItems.map((item) => renderMenuItem(item, "root"))}
                    </nav>
                </Card>
            </aside>

            {/* Desktop sidebar in flex flow */}
            <aside
                className={`hidden h-full shrink-0 overflow-hidden transition-[width,padding] duration-300 ease-in-out lg:block ${isOpen ? "w-72 pl-4 py-4" : "w-0 p-0"
                    }`}
                aria-hidden={!isOpen}
            >
                <Card
                    className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${isOpen
                        ? "opacity-100"
                        : "invisible opacity-0 pointer-events-none"
                        }`}
                >
                    <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6 gap-2">
                        {visibleItems.map((item) => renderMenuItem(item, "root-desktop"))}
                    </nav>
                </Card>
            </aside>
        </>
    );
}
