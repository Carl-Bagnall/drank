import { NavLink } from "react-router";
import type { ReactNode } from "react";

/**
 * Primary mobile navigation.
 *
 * Fixed to the bottom because the app is meant to be used one-handed while
 * standing in a shop. Every target is at least 44x44 CSS px (WCAG 2.2 AA
 * "Target Size (Minimum)" asks for 24x24; 44 is the comfortable iOS figure).
 *
 * Scan is visually emphasised as the centre action, since barcode scanning is
 * the interaction the product is ultimately built around.
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
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscoverIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m16.5 16.5 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
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
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollectionIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface TabProps {
  to: string;
  label: string;
  children: ReactNode;
}

function Tab({ to, label, children }: TabProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[0.6875rem] font-medium transition-colors",
          isActive ? "text-cherry" : "text-ink-muted hover:text-ink",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            {children}
            {/* A shape change, not just a colour change, so the active tab is
                distinguishable without relying on colour perception. */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-cherry"
              />
            )}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNavigation() {
  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-stretch gap-0.5 px-2 pt-1">
        <li className="flex flex-1">
          <Tab to="/" label="Home">
            <HomeIcon className="size-6" />
          </Tab>
        </li>
        <li className="flex flex-1">
          <Tab to="/discover" label="Discover">
            <DiscoverIcon className="size-6" />
          </Tab>
        </li>

        {/* Scan sits proud of the bar as the emphasised action. */}
        <li className="flex flex-1 justify-center">
          <NavLink
            to="/scan"
            aria-label="Scan a barcode"
            className="flex min-h-11 flex-col items-center justify-center gap-1 pt-1.5 text-[0.6875rem] font-medium text-ink-muted"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-cherry text-white shadow-raised">
              <ScanIcon className="size-6" />
            </span>
            <span>Scan</span>
          </NavLink>
        </li>

        <li className="flex flex-1">
          <Tab to="/collection" label="Collection">
            <CollectionIcon className="size-6" />
          </Tab>
        </li>
        <li className="flex flex-1">
          <Tab to="/profile" label="Profile">
            <ProfileIcon className="size-6" />
          </Tab>
        </li>
      </ul>
    </nav>
  );
}
