import { Fragment, useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAtomValue } from "jotai";
import { Accordion, Button, Card, SearchField } from "@heroui/react";
import { useIntl } from "react-intl";
import { Icon } from "@iconify/react";
import {
  NAV_MENU,
  NAV_SECTION_LABEL_KEYS,
  NAV_SECTION_ORDER,
  type NavMenuItem,
  type NavSectionId,
} from "../constants/nav-menu";
import { NAV_ICON_REGISTRY } from "../assets/NavIcons";
import { hasPermissionAtom } from "../lib/atoms";
import { useIsDesktop } from "../lib/useIsDesktop";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const isDesktop = useIsDesktop();

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
          className={`hidden h-full shrink-0 overflow-hidden transition-[width,padding] duration-300 ease-in-out lg:block ${
            isOpen ? "w-72 pl-4 py-4" : "w-0 p-0"
          }`}
          aria-hidden={!isOpen}
        >
          <div
            className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${
              isOpen ? "opacity-100" : "invisible pointer-events-none opacity-0"
            }`}
          >
            <Card className="h-full">
              <SidebarContent />
            </Card>
          </div>
        </aside>
      ) : isOpen ? (
        <aside className="fixed left-0 top-0 z-40 h-screen w-72 transform bg-transparent px-4 pb-4 pt-2 transition-transform duration-300 ease-in-out lg:hidden translate-x-0">
          <div className="flex h-full flex-col overflow-hidden">
            <Card className="h-full">
              <SidebarContent onClose={onClose} />
            </Card>
          </div>
        </aside>
      ) : null}
    </>
  );
}

/** Shared nav body — search field + grouped sections — used by desktop aside and mobile drawer. */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const isDesktop = useIsDesktop();

  const [query, setQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(() => new Set());
  const [collapsedKeys, setCollapsedKeys] = useState<Set<Key>>(() => new Set());

  const normalizePath = (path: string) => {
    if (path.length > 1 && path.endsWith("/")) {
      return path.slice(0, -1);
    }

    return path;
  };

  const isPathActive = (href: string) => {
    const currentPath = normalizePath(location.pathname);
    const targetPath = normalizePath(href);

    if (targetPath === "/") {
      return currentPath === "/";
    }

    return (
      currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
    );
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    if (!isDesktop) onClose?.();
  };

  const getMenuLabel = (name: string) =>
    intl.formatMessage({ id: name, defaultMessage: name });

  const menuHeading = intl.formatMessage({
    id: "nav_menu",
    defaultMessage: "Menu",
  });
  const searchLabel = intl.formatMessage({
    id: "nav.search_placeholder",
    defaultMessage: "Search menu...",
  });

  const renderIcon = (icon: string) => {
    const NavIcon = NAV_ICON_REGISTRY[icon];
    if (NavIcon) {
      return (
        <span
          style={{
            display: "inline-flex",
            width: 28,
            height: 28,
            flexShrink: 0,
          }}
        >
          <NavIcon size={28} style={{ width: 28, height: 28 }} />
        </span>
      );
    }

    return null;
  };

  const filterByPermission = (items: NavMenuItem[]): NavMenuItem[] => {
    const filtered: Array<NavMenuItem | undefined> = items.map((item) => {
      const children = item.children
        ? filterByPermission(item.children)
        : undefined;
      const visibleChildren = children?.length ? children : undefined;
      const itemAllowed = !item.permission || hasPermission(item.permission);

      if (!itemAllowed && !visibleChildren) {
        return undefined;
      }

      // A group header without its own link is only useful when it has
      // visible children. Without this, a permission-less parent (e.g.
      // Access Control for a user with neither user@read nor role@read)
      // renders as a dead button that navigates nowhere.
      if (!item.href && !visibleChildren) {
        return undefined;
      }

      return {
        ...item,
        children: visibleChildren,
      };
    });

    return filtered.filter(
      (item: NavMenuItem | undefined): item is NavMenuItem =>
        item !== undefined,
    );
  };

  const visibleItems = useMemo(
    () => filterByPermission(NAV_MENU),
    [hasPermission],
  );

  const matchesQuery = (item: NavMenuItem, q: string) => {
    const label = getMenuLabel(item.name).toLowerCase();
    const keyTail = (item.name.split(".").pop() ?? item.name).toLowerCase();
    return (
      label.includes(q) ||
      keyTail.includes(q) ||
      (item.href?.toLowerCase().includes(q) ?? false)
    );
  };

  /** Keeps the whole subtree when the parent matches; otherwise keeps only matching children. */
  const filterByQuery = (items: NavMenuItem[], q: string): NavMenuItem[] =>
    items
      .reduce<Array<NavMenuItem | undefined>>((acc, item) => {
        if (matchesQuery(item, q)) {
          acc.push(item);
          return acc;
        }

        const children = item.children
          ? filterByQuery(item.children, q)
          : undefined;
        if (children?.length) {
          acc.push({ ...item, children });
        } else {
          acc.push(undefined);
        }

        return acc;
      }, [])
      .filter((item): item is NavMenuItem => item !== undefined);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const displayedItems = isSearching
    ? filterByQuery(visibleItems, normalizedQuery)
    : visibleItems;

  const groupedBySection = useMemo(() => {
    const map = new Map<NavSectionId, NavMenuItem[]>();
    for (const item of displayedItems) {
      const section = item.section ?? "overview";
      const list = map.get(section) ?? [];
      list.push(item);
      map.set(section, list);
    }
    return map;
  }, [displayedItems]);

  const searchResultCount = useMemo(() => {
    const countLeaf = (items: NavMenuItem[]): number =>
      items.reduce(
        (sum, item) =>
          sum + (item.children?.length ? countLeaf(item.children) : 1),
        0,
      );
    return countLeaf(displayedItems);
  }, [displayedItems]);

  const isParentExpanded = (item: NavMenuItem) => {
    if (isSearching) return true;
    if (collapsedKeys.has(item.name)) return false;
    if (expandedKeys.has(item.name)) return true;
    // Auto-expand sections whose child page is currently open (first mount).
    return Boolean(
      item.children?.some((child) => child.href && isPathActive(child.href)),
    );
  };

  const toggleExpanded = (name: string, next: boolean) => {
    if (next) {
      setCollapsedKeys((prev) => {
        if (!prev.has(name)) return prev;
        const nextKeys = new Set(prev);
        nextKeys.delete(name);
        return nextKeys;
      });
      setExpandedKeys((prev) => {
        if (prev.has(name)) return prev;
        const nextKeys = new Set(prev);
        nextKeys.add(name);
        return nextKeys;
      });
    } else {
      setCollapsedKeys((prev) => {
        if (prev.has(name)) return prev;
        const nextKeys = new Set(prev);
        nextKeys.add(name);
        return nextKeys;
      });
      setExpandedKeys((prev) => {
        if (!prev.has(name)) return prev;
        const nextKeys = new Set(prev);
        nextKeys.delete(name);
        return nextKeys;
      });
    }
  };

  const renderNavButton = (item: NavMenuItem, indent = false) => {
    const active = Boolean(item.href && isPathActive(item.href));

    return (
      <div key={item.name} className="relative">
        {active ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent"
          />
        ) : null}
        <Button
          variant="ghost"
          fullWidth
          onPress={() => (item.href ? handleNavigate(item.href) : undefined)}
          className={`h-auto justify-start gap-2 py-2 text-sm ${indent ? "pl-7" : "pl-2"} ${active ? "bg-accent/10 font-semibold text-accent hover:bg-accent/15" : "text-foreground"}`}
        >
          {renderIcon(item.icon || "")}
          {getMenuLabel(item.name)}
        </Button>
      </div>
    );
  };

  /** Search mode: flat list, groups auto-expanded, children indented. */
  const renderSearchResult = (item: NavMenuItem, depth = 0): ReactNode => {
    if (item.children?.length) {
      return (
        <Fragment key={item.name}>
          <div
            className={`flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-foreground ${depth > 0 ? "pl-7" : "pl-2"}`}
          >
            {renderIcon(item.icon || "")}
            {getMenuLabel(item.name)}
          </div>
          {item.children.map((child) => renderSearchResult(child, depth + 1))}
        </Fragment>
      );
    }

    return renderNavButton(item, depth > 0);
  };

  const renderGroupedItem = (
    item: NavMenuItem,
    parentKey: string,
  ): ReactNode => {
    if (item.children?.length) {
      const childActive = item.children.some(
        (child) => child.href && isPathActive(child.href),
      );

      return (
        <Accordion
          key={`${parentKey}/${item.name}`}
          variant="surface"
          hideSeparator
          className="rounded-lg"
          expandedKeys={
            isParentExpanded(item) ? new Set([item.name]) : new Set()
          }
          onExpandedChange={(keys: Set<Key>) =>
            toggleExpanded(item.name, keys.has(item.name))
          }
        >
          <Accordion.Item key={item.name} id={item.name}>
            <Accordion.Heading>
              <Accordion.Trigger className="gap-2 rounded-lg py-2 pl-2">
                {renderIcon(item.icon || "")}
                <span
                  className={childActive ? "font-semibold text-accent" : ""}
                >
                  {getMenuLabel(item.name)}
                </span>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <div className="space-y-1 border-l border-border/60 pl-3">
                  {item.children.map((child) => renderNavButton(child, true))}
                </div>
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      );
    }

    return renderNavButton(item);
  };

  const renderSection = (sectionId: NavSectionId) => {
    const items = groupedBySection.get(sectionId);
    if (!items?.length) return null;

    return (
      <div key={sectionId} className="space-y-1">
        <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted first:pt-0">
          {intl.formatMessage({
            id: NAV_SECTION_LABEL_KEYS[sectionId],
            defaultMessage: sectionId,
          })}
        </p>
        {isSearching
          ? items.map((item) => renderSearchResult(item))
          : items.map((item) => renderGroupedItem(item, "root"))}
      </div>
    );
  };

  return (
    <>
      <Card.Header>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-bold">{menuHeading}</span>
            {onClose ? (
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Close sidebar"
                onPress={onClose}
              >
                <Icon icon="solar:close-circle-linear" className="size-5" />
              </Button>
            ) : null}
          </div>
          <SearchField
            fullWidth
            variant="secondary"
            aria-label={searchLabel}
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={searchLabel} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {isSearching ? (
            <p className="text-xs text-muted">
              {intl.formatMessage(
                {
                  id: "nav.search_results",
                  defaultMessage:
                    "{count, plural, one {# page found} other {# pages found}}",
                },
                { count: searchResultCount },
              )}
            </p>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="min-h-0 flex-1 overflow-hidden">
        <nav
          aria-label={menuHeading}
          className="h-full space-y-1 overflow-y-auto pb-2 pr-1"
        >
          {NAV_SECTION_ORDER.map((sectionId) => renderSection(sectionId))}
          {isSearching && searchResultCount === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-surface">
                <Icon
                  icon="solar:magnifer-linear"
                  className="size-5 text-muted"
                />
              </span>
              <p className="text-sm font-medium text-foreground">
                {intl.formatMessage({
                  id: "nav.search_no_results",
                  defaultMessage: "No pages found",
                })}
              </p>
              <p className="text-xs text-muted">
                {intl.formatMessage(
                  {
                    id: "nav.search_no_results_hint",
                    defaultMessage: "No menu matches “{query}”",
                  },
                  { query: query.trim() },
                )}
              </p>
            </div>
          ) : null}
        </nav>
      </Card.Content>
    </>
  );
}

export { Sidebar };
