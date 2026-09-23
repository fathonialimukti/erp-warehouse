/** T10 payload caps: the scrape travels on EVERY chat send, so unbounded
 * section / option lists must not bloat the request body. `MAX_SECTIONS`
 * (50) is far above any real page; option lists are capped at 100/key
 * (SelectSearch defaults to `limit = 50`, so real lists are never cut). */
const MAX_SECTIONS = 50;
const MAX_OPTIONS_PER_KEY = 100;

interface NormalizedOption {
  id: string;
  label: string;
}

/** Cap + clean one raw option list into stable `{ id, label }[]`, deduped by id. */
const toOptionList = (value: unknown): NormalizedOption[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: NormalizedOption[] = [];
  for (const entry of value) {
    if (out.length >= MAX_OPTIONS_PER_KEY) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = record.id == null ? '' : String(record.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = record.label == null ? id : String(record.label);
    out.push({ id, label });
  }
  return out;
};

/** Which stable alias (if any) a `data-ai-select-options` key feeds.
 * Keys are `queryKeyBase` values (`supplier-form-search`, `{rowId}-sku`,
 * `poSupplier`, ...) so match by substring, case-insensitive. */
const aliasForKey = (key: string): 'supplier' | 'warehouse' | 'sku' | null => {
  const lower = key.toLowerCase();
  if (lower.includes('supplier')) return 'supplier';
  if (lower.includes('warehouse')) return 'warehouse';
  if (lower.includes('sku')) return 'sku';
  return null;
};

/**
 * Normalize a parsed DOM scrape (T10 — normalize before stringify/send):
 * cap `sections` at 50, cap every `selectOptions` list at 100/key, and merge
 * matching option lists into stable top-level `supplier` / `warehouse` /
 * `sku` aliases (deduped by id, first-seen order kept) so the assistant can
 * resolve select labels to ids without knowing each page's `queryKeyBase`.
 *
 * Idempotent — safe to run on an already-normalized payload. Only operates
 * on plain JSON bubbles (the output of `JSON.parse(collectPageContext())`).
 */
export const normalizeScrapedContext = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = { ...input };
  if (Array.isArray(out.sections)) out.sections = out.sections.slice(0, MAX_SECTIONS);
  const rawOptions = out.selectOptions;
  if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) {
    const selectOptions: Record<string, NormalizedOption[]> = {};
    for (const [key, value] of Object.entries(rawOptions as Record<string, unknown>)) {
      selectOptions[key] = toOptionList(value);
    }
    out.selectOptions = selectOptions;
    // Stable aliases merged across every matching key (e.g. one `-sku`
    // block per item row), deduped by id, still capped at 100.
    const aliasSeen: Record<'supplier' | 'warehouse' | 'sku', Set<string>> = {
      supplier: new Set(),
      warehouse: new Set(),
      sku: new Set(),
    };
    const aliased: Record<'supplier' | 'warehouse' | 'sku', NormalizedOption[]> = {
      supplier: [],
      warehouse: [],
      sku: [],
    };
    for (const [key, options] of Object.entries(selectOptions)) {
      const alias = aliasForKey(key);
      if (!alias) continue;
      for (const option of options) {
        if (aliased[alias].length >= MAX_OPTIONS_PER_KEY) break;
        if (aliasSeen[alias].has(option.id)) continue;
        aliasSeen[alias].add(option.id);
        aliased[alias].push(option);
      }
    }
    for (const alias of ['supplier', 'warehouse', 'sku'] as const) {
      if (aliased[alias].length > 0) out[alias] = aliased[alias];
    }
  }
  return out;
};

/** Scrape all [data-ai-context] annotations from the current DOM into a JSON string. */
export const collectPageContext = (): string => {
  const route = window.location.pathname;
  const heading = document.querySelector('h1')?.textContent?.trim() ?? '';
  const browserTitle = document.title.replace(/\s*[|–-].*$/, '').trim();
  const title = heading || browserTitle;
  const visibleButtons = Array.from(document.querySelectorAll('button'))
    .map(btn => btn.textContent?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 8);
  const tableCount = document.querySelectorAll('table,[role="table"]').length;
  const inputCount = document.querySelectorAll('input:not([type=hidden]),textarea,select').length;
  const sections: unknown[] = [];

  document.querySelectorAll('[data-ai-context]').forEach(el => {
    const raw = el.getAttribute('data-ai-context');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      sections.push(parsed);
    } catch {
      // skip malformed attribute
    }
  });

  // Scrape SelectSearch dropdown options exposed via data-ai-select-options
  const selectOptions: Record<string, unknown[]> = {};
  document.querySelectorAll('[data-ai-select-options]').forEach(el => {
    const name = el.getAttribute('data-ai-select-options');
    const raw = el.textContent?.trim();
    if (name && raw) {
      try { selectOptions[name] = JSON.parse(raw) as unknown[]; } catch { /* skip */ }
    }
  });

  return JSON.stringify(
    normalizeScrapedContext({
      route,
      title,
      heading: heading || null,
      browserTitle,
      quickStats: {
        tableCount,
        inputCount,
        visibleButtonCount: visibleButtons.length,
      },
      visibleButtons,
      sections,
      ...(Object.keys(selectOptions).length > 0 ? { selectOptions } : {}),
    }),
  );
};
