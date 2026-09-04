import { Outlet } from "react-router";
import { BottomNavigation } from "./BottomNavigation";
import { Logo } from "./Logo";

/**
 * The application shell: a compact sticky header, a scrolling main region,
 * and the fixed bottom navigation.
 *
 * `max-w-lg` keeps the phone layout centred on desktop rather than stretching
 * a mobile-first design across a wide monitor. Wider desktop layouts are a
 * Phase 6 concern; this at least stops it looking broken.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh bg-cream">
      {/* Lets keyboard and screen-reader users jump past the header. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream"
      >
        Skip to content
      </a>

      <header className="pt-safe sticky top-0 z-30 border-b border-hairline bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logo />
        </div>
      </header>

      {/* Bottom padding clears the fixed nav (about 4.5rem) plus safe area. */}
      <main id="main" className="mx-auto max-w-lg px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <BottomNavigation />
    </div>
  );
}
