import { useEffect } from "react";

interface PageTitleProps {
  /** Localized page title, e.g. `"SKU Catalog"`. */
  title: string;
}

/** Suffix appended to every page title so the tab always carries the product. */
const TITLE_SUFFIX = "WMS";

/**
 * Renders nothing — mirrors `title` into `document.title` for the lifetime of
 * the page. Rendered once per page (usually from `PageHeader`) so every route
 * gets a real tab title instead of the static `index.html` default.
 *
 * The separator is a hyphen on purpose: the AI page-context scrapers strip
 * everything after the first `|`/`–`/`-` in `document.title` to recover the
 * bare page name.
 */
export function PageTitle({ title }: PageTitleProps) {
  useEffect(() => {
    document.title = `${title} - ${TITLE_SUFFIX}`;
  }, [title]);

  return null;
}
