import { useEffect } from "react";

/**
 * Sets `document.title` (and the meta description, if one exists) for a
 * marketing page. The app uses the data router, not framework mode, so there
 * is no meta API — this hook is the whole SEO story for the marketing site.
 */
export function usePageTitle(
  title: string,
  options?: { description?: string },
) {
  const { description } = options ?? {};

  useEffect(() => {
    document.title = title;

    if (!description) return;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
  }, [title, description]);
}
