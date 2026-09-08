import { useEffect } from "react";

const SUFFIX = "Drank";

/**
 * Sets the document title for a page.
 *
 * A single-page app does not change the title on its own, so every route
 * reported "Drank". That matters beyond neatness: the title is what a screen
 * reader announces on navigation, what labels entries in browser history and
 * the tab switcher, and what is saved when someone bookmarks a drink.
 *
 * Pass null while data is loading to leave the previous title in place rather
 * than flashing a placeholder.
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    document.title = title === SUFFIX ? SUFFIX : `${title} · ${SUFFIX}`;
  }, [title]);
}
