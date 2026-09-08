import { Outlet } from "react-router";
import { RouteChange } from "./RouteChange";
import { BottomNavigation } from "./BottomNavigation";
import { Logo } from "./Logo";

/**
 * The application shell: a sticky header with a heavy rule beneath it, a
 * scrolling main region, and the fixed bottom navigation.
 *
 * `max-w-lg` keeps the phone layout centred on desktop rather than stretching
 * a mobile-first design across a wide monitor. A proper desktop layout is a
 * Phase 6 concern.
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:border-[2.5px] focus:border-ink focus:bg-citrus focus:px-4 focus:py-2 focus:font-display focus:text-sm"
      >
        Skip to content
      </a>

      <header className="pt-safe sticky top-0 z-30 border-b-[3px] border-ink bg-paper">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logo />
        </div>
      </header>

      {/* Bottom padding clears the fixed nav plus the safe area. */}
      {/* tabIndex -1 so RouteChange can move focus here after navigation
          without putting main into the tab order. `outline-none` because that
          focus is programmatic — the user did not tab to it, so a ring would
          be confusing; genuine keyboard focus is still visible everywhere
          else via :focus-visible. */}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-lg px-4 pb-32 pt-5 outline-none"
      >
        <Outlet />
      </main>

      <BottomNavigation />
      <RouteChange mainId="main" />
    </div>
  );
}
