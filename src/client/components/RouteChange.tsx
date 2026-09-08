import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/**
 * What each route is called, for the screen-reader announcement.
 *
 * Deliberately static rather than reading `document.title`: a page that sets
 * its title after fetching would otherwise be announced as "Loading". A
 * dependable, slightly generic announcement beats an accurate one that
 * arrives too late or not at all.
 */
function routeLabel(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/drinks/new")) return "Add a drink";
  if (pathname.startsWith("/drinks/")) return "Drink details";
  if (pathname.startsWith("/discover")) return "Discover";
  if (pathname.startsWith("/scan")) return "Scan a barcode";
  if (pathname.startsWith("/collection")) return "Your collection";
  if (pathname.startsWith("/wantlist")) return "Your wantlist";
  if (pathname.startsWith("/profile")) return "Your profile";
  if (pathname.startsWith("/signin")) return "Sign in";
  return "Page not found";
}

/**
 * Makes client-side navigation behave like a real page change.
 *
 * Three things a browser does for free on a full page load, and that a
 * single-page app has to do for itself:
 *
 *   Scroll position — without this, tapping a drink from halfway down
 *     Discover lands you halfway down the drink, which reads as a broken page
 *     on a phone.
 *   Focus — focus otherwise stays on the link that was activated, which is
 *     now gone, so keyboard users are dumped at the top of the document with
 *     no context and screen reader users hear nothing at all.
 *   An announcement — a polite live region naming the new page, which is what
 *     tells a screen reader user the navigation actually happened.
 */
export function RouteChange({ mainId }: { mainId: string }) {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState("");
  // Compares the previous path rather than tracking "is this the first
  // render". A boolean guard is defeated by StrictMode, which invokes effects
  // twice in development: the second run finds the flag already cleared and
  // acts as though a navigation happened, stealing focus on initial load.
  // Seeding this with the current path means no run does anything until the
  // path actually changes.
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    // `instant` on purpose: a smooth scroll during a page change is motion
    // nobody asked for, and it fights with the new content rendering.
    window.scrollTo({ top: 0, behavior: "instant" });

    const main = document.getElementById(mainId);
    if (main) {
      // tabIndex -1 makes a non-interactive element programmatically
      // focusable without adding it to the tab order.
      main.focus({ preventScroll: true });
    }

    setAnnouncement(routeLabel(pathname));
  }, [pathname, mainId]);

  return (
    <div
      // `polite` waits for the screen reader to finish its current sentence,
      // rather than cutting across whatever the user was already hearing.
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
