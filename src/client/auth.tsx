import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CollectionStats, PublicUser } from "../shared/types";
import * as api from "./api";

/**
 * Authentication state.
 *
 * The session itself lives in an httpOnly cookie the browser sends
 * automatically — this context only mirrors *who* that cookie belongs to, so
 * the UI can render the right thing. There is no token in JavaScript to
 * steal, and nothing here is trusted for authorisation: the Worker checks
 * every request regardless of what this state says.
 */

interface AuthState {
  user: PublicUser | null;
  stats: CollectionStats | null;
  /** True until the initial "who am I" request settles. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the user and stats, e.g. after the collection changes. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const me = await api.getMe(signal);
      setUser(me.user);
      setStats(me.stats);
    } catch {
      // A 401 here is the normal signed-out case, not an error worth showing.
      setUser(null);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      stats,
      loading,
      signIn: async (email, password) => {
        const { user: signedIn } = await api.login({ email, password });
        setUser(signedIn);
        await load();
      },
      signUp: async (username, email, password) => {
        const { user: created } = await api.register({ username, email, password });
        setUser(created);
        await load();
      },
      signOut: async () => {
        await api.logout();
        setUser(null);
        setStats(null);
      },
      refresh: () => load(),
    }),
    [user, stats, loading, load],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
