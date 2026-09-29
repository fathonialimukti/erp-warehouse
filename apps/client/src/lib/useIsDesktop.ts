import { useEffect, useState } from "react";

/**
 * Returns `true` when the viewport matches the `lg` breakpoint (≥1024px).
 *
 * Used to conditionally render desktop-only vs mobile-only subtrees so that
 * elements with DOM-wide unique IDs (e.g. SVG gradient ids) are not duplicated
 * across a hidden + visible instance — which breaks `url(#id)` references.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
