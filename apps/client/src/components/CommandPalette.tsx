import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import { hasPermissionAtom } from '../lib/atoms';
import { trpcClient } from '../lib/trpc';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

interface PaletteEntry {
  key: string;
  label: string;
  url: string;
  isAction: boolean;
  icon: string;
}

interface QuickAction {
  id: string;
  label: string;
  url: string;
  permission: string;
  icon: string;
}

const RECENTS_KEY = 'command-palette-recents';
const MAX_RECENTS = 6;

const readRecents = (): SearchResult[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as SearchResult[]) : [];
  } catch {
    return [];
  }
};

const pushRecent = (result: SearchResult): void => {
  const recents = [result, ...readRecents().filter((r) => r.url !== result.url)].slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
};

export function CommandPalette({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults, isFetching } = useQueryEnabled(debounced, isOpen);

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      { id: 'new-receiving', label: intl.formatMessage({ id: 'palette.new_receiving', defaultMessage: 'New receiving transaction' }), url: '/inbound-transaction/receiving/new', permission: 'receiving@create', icon: 'solar:inbox-in-linear' },
      { id: 'new-shipment', label: intl.formatMessage({ id: 'palette.new_shipment', defaultMessage: 'New shipment' }), url: '/outbound-transaction/shipment/new', permission: 'shipment@create', icon: 'solar:truck-linear' },
      { id: 'new-po', label: intl.formatMessage({ id: 'palette.new_po', defaultMessage: 'New purchase order' }), url: '/purchase-order/new', permission: 'purchase_order@create', icon: 'solar:cart-linear' },
      { id: 'new-count', label: intl.formatMessage({ id: 'palette.new_count', defaultMessage: 'New cycle count' }), url: '/stock-count/new', permission: 'stock_count@create', icon: 'solar:clipboard-list-linear' },
      { id: 'go-reorder', label: intl.formatMessage({ id: 'palette.go_reorder', defaultMessage: 'Go to reorder points' }), url: '/reorder', permission: 'reorder@read', icon: 'solar:chart-linear' },
      { id: 'go-logs', label: intl.formatMessage({ id: 'palette.go_logs', defaultMessage: 'Go to system logs' }), url: '/logs', permission: 'log@read', icon: 'solar:document-linear' },
      { id: 'go-settings', label: intl.formatMessage({ id: 'palette.go_settings', defaultMessage: 'Go to settings' }), url: '/settings', permission: 'settings@read', icon: 'solar:settings-linear' },
    ];
    return actions.filter((action) => hasPermission(action.permission));
  }, [intl, hasPermission]);

  const filteredActions = useMemo(
    () =>
      debounced
        ? quickActions.filter((action) => action.label.toLowerCase().includes(debounced.toLowerCase()))
        : quickActions.slice(0, 5),
    [quickActions, debounced],
  );

  const flatResults = useMemo(() => {
    const recents = debounced ? [] : readRecents();
    return { recents, groups: searchResults?.groups ?? [] };
  }, [searchResults, debounced]);

  const allEntries = useMemo<PaletteEntry[]>(() => [
    ...flatResults.recents.map((entry) => ({ key: `recent-${entry.id}`, label: entry.title, url: entry.url, isAction: false, icon: 'solar:history-linear' })),
    ...filteredActions.map((action) => ({ key: `action-${action.id}`, label: action.label, url: action.url, isAction: true, icon: action.icon })),
    ...flatResults.groups.flatMap((group) =>
      group.results.map((result) => ({ key: `${result.type}-${result.id}`, label: result.title, url: result.url, isAction: false, icon: 'solar:document-linear' })),
    ),
  ], [flatResults, filteredActions]);

  const handleSelect = (entry: PaletteEntry) => {
    onOpenChange(false);
    if (!entry.isAction) {
      pushRecent({ type: 'recent', id: entry.key, title: entry.label, subtitle: null, url: entry.url });
    }
    navigate(entry.url);
  };

  useEffect(() => setActiveIndex(0), [debounced]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header className="border-b p-0">
              <div className="flex w-full items-center gap-2 px-4 py-3">
                <Icon icon="solar:magnifer-linear" className="size-5 text-muted" />
                <input
                  ref={inputRef}
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIndex((prev) => Math.min(prev + 1, allEntries.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter' && allEntries[activeIndex]) {
                      e.preventDefault();
                      handleSelect(allEntries[activeIndex]!);
                    } else if (e.key === 'Escape') {
                      onOpenChange(false);
                    }
                  }}
                  placeholder={intl.formatMessage({
                    id: 'palette.placeholder',
                    defaultMessage: 'Search documents, SKUs, pallets… or type a command',
                  })}
                  aria-label={intl.formatMessage({ id: 'palette.placeholder', defaultMessage: 'Search' })}
                />
                <kbd className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="max-h-96 overflow-y-auto">
                {isFetching && debounced ? (
                  <p className="px-3 py-2 text-xs text-muted">
                    {intl.formatMessage({ id: 'palette.searching', defaultMessage: 'Searching…' })}
                  </p>
                ) : null}

                {!debounced && flatResults.recents.length > 0 ? (
                  <div className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {intl.formatMessage({ id: 'palette.recents', defaultMessage: 'Recent' })}
                    </p>
                    {flatResults.recents.map((entry) => renderEntry(entry))}
                  </div>
                ) : null}

                {filteredActions.length > 0 ? (
                  <div className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {intl.formatMessage({ id: 'palette.actions', defaultMessage: 'Actions' })}
                    </p>
                    {filteredActions.map((action) => {
                      const flatIndex = allEntries.findIndex((entry) => entry.key === `action-${action.id}`);
                      return (
                        <button
                          key={action.id}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                            flatIndex === activeIndex ? 'bg-default-100' : ''
                          }`}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => handleSelect({ key: `action-${action.id}`, label: action.label, url: action.url, isAction: true, icon: action.icon })}
                        >
                          <Icon icon={action.icon} className="size-4 text-muted" />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {flatResults.groups.map((group) => (
                  <div key={group.type} className="mb-2">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{group.type}</p>
                    {group.results.map((result) => {
                      const entryKey = `${result.type}-${result.id}`;
                      const flatIndex = allEntries.findIndex((entry) => entry.key === entryKey);
                      return (
                        <button
                          key={entryKey}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                            flatIndex === activeIndex ? 'bg-default-100' : ''
                          }`}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => handleSelect({ key: entryKey, label: result.title, url: result.url, isAction: false, icon: 'solar:document-linear' })}
                        >
                          <Icon icon="solar:document-linear" className="size-4 text-muted" />
                          <span className="font-mono">{result.title}</span>
                          {result.subtitle ? <span className="text-xs text-muted">{result.subtitle}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {debounced && !isFetching && allEntries.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">
                    {intl.formatMessage({ id: 'palette.no_results', defaultMessage: 'No results found.' })}
                  </p>
                ) : null}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );

  function renderEntry(entry: SearchResult) {
    const entryKey = `recent-${entry.id}`;
    const flatIndex = allEntries.findIndex((candidate) => candidate.key === entryKey);
    return (
      <button
        key={entryKey}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
          flatIndex === activeIndex ? 'bg-default-100' : ''
        }`}
        onMouseEnter={() => setActiveIndex(flatIndex)}
        onClick={() => handleSelect({ key: entryKey, label: entry.title, url: entry.url, isAction: false, icon: 'solar:history-linear' })}
      >
        <Icon icon="solar:history-linear" className="size-4 text-muted" />
        <span className="font-mono">{entry.title}</span>
      </button>
    );
  }
}

// Small wrapper to keep the query conditional
function useQueryEnabled(term: string, isOpen: boolean) {
  return useQuery({
    queryKey: ['globalSearch', term],
    enabled: isOpen && term.length > 0,
    queryFn: () => trpcClient.search.global.query({ q: term }),
    staleTime: 10_000,
  });
}
