import { NavLink } from "react-router";
import type { ReactNode } from "react";

/**
 * Primary mobile navigation.
 *
 * Fixed to the bottom because the app is meant to be used one-handed while
 * standing in a shop. Every target is at least 44x44 CSS px.
 *
 * The active tab is a filled sticker pill — a shape and outline change, not
 * just a colour change, so it stays distinguishable without colour perception.
 * Scan is the emphasised centre action and lifts out of the bar entirely.
 */

interface IconProps {
  className?: string;
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscoverIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="m16.5 16.5 4 4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScanIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function CollectionIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface TabProps {
  to: string;
  label: string;
  /** Fill colour of the active sticker pill. */
  tone: string;
  children: ReactNode;
}

function Tab({ to, label, tone, children }: TabProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 py-1 text-ink"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              "flex size-9 items-center justify-center rounded-[10px] transition-transform",
              isActive
                // `text-ink` is on this element rather than inherited from the
                // link: the accent fill re-anchors ink to its own dark value,
                // and a colour inherited from an ancestor was resolved before
                // that — in dark mode the icon would arrive cream on citrus.
                ? `${tone} border-[2.5px] border-ink text-ink shadow-[var(--shadow-sticker-sm)]`
                : "border-[2.5px] border-transparent",
            ].join(" ")}
          >
            {children}
          </span>
          <span
            className={[
              "text-[0.625rem] leading-none",
              isActive ? "font-display" : "font-medium text-ink-muted",
            ].join(" ")}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNavigation() {
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper"
    >
      <ul className="mx-auto flex max-w-lg items-end gap-0.5 px-2 pt-1.5">
        <li className="flex flex-1">
          <Tab to="/" label="Home" tone="bg-citrus">
            <HomeIcon className="size-5" />
          </Tab>
        </li>
        <li className="flex flex-1">
          <Tab to="/discover" label="Discover" tone="bg-fizz">
            <DiscoverIcon className="size-5" />
          </Tab>
        </li>

        {/* Scan breaks the grid and sits proud of the bar. */}
        <li className="flex flex-1 justify-center">
          <NavLink
            to="/scan"
            aria-label="Scan a barcode"
            className="group -mt-6 flex min-h-11 flex-col items-center gap-1"
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    "flex size-14 items-center justify-center rounded-full border-[3px] border-ink bg-cherry text-ink shadow-[var(--shadow-sticker)] transition-transform group-active:translate-x-[3px] group-active:translate-y-[3px] group-active:shadow-none",
                    // Scan is always emphasised, so it needs its own "you are
                    // here" signal: an outer ink ring the other tabs get from
                    // their filled pill.
                    isActive ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper" : "",
                  ].join(" ")}
                >
                  <ScanIcon className="size-7" />
                </span>
                <span className="font-display text-[0.625rem] leading-none text-ink">
                  Scan
                </span>
              </>
            )}
          </NavLink>
        </li>

        <li className="flex flex-1">
          <Tab to="/collection" label="Collection" tone="bg-lime">
            <CollectionIcon className="size-5" />
          </Tab>
        </li>
        <li className="flex flex-1">
          <Tab to="/profile" label="Profile" tone="bg-berry">
            <ProfileIcon className="size-5" />
          </Tab>
        </li>
      </ul>
    </nav>
  );
}
