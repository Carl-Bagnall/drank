import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** What the user chose. "system" defers to the OS setting, and keeps deferring. */
export type ThemePreference = "light" | "dark" | "system";

/** What is actually on screen once "system" has been resolved. */
export type ResolvedTheme = "light" | "dark";

/**
 * Shared with the inline script in index.html, which applies the theme before
 * first paint. If either changes, both must — a mismatch means the page paints
 * one theme and then flips to the other.
 */
const STORAGE_KEY = "drank-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Browser chrome colour. Matches `--paper` in each palette. */
const THEME_COLOUR: Record<ResolvedTheme, string> = {
  light: "#fbf5e9",
  dark: "#14110d",
};

interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Reads the stored preference.
 *
 * Every localStorage access here is guarded: Safari throws on access in
 * private browsing, and a theme setting is not worth taking the app down for.
 * The fallback is "system", which is also the default for a first visit.
 */
function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return "system";
}

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Owns the theme.
 *
 * `data-theme` on <html> carries the *resolved* theme rather than the
 * preference, so the stylesheet only needs one `[data-theme="dark"]` block
 * instead of duplicating every token under a media query as well.
 *
 * The inline script in index.html does this same work before first paint. This
 * provider takes over from it, and is what makes the setting reactive: with
 * "system" chosen, a change to the OS setting flips the app immediately
 * instead of waiting for a reload.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    // The OS setting can have changed between the initial read and this
    // effect running.
    setSystemDark(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    // Tells the browser to draw form controls, scrollbars and the caret to
    // match. CSS sets this too; setting it here keeps the two in step when the
    // theme changes without a reload.
    root.style.colorScheme = resolved;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOUR[resolved]);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; it just will not persist.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return value;
}

