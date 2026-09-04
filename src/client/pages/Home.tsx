import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "../api";
import { ErrorState, LoadingState } from "../components/States";
import { Logo } from "../components/Logo";

type State =
  | { kind: "loading" }
  | { kind: "ready"; health: HealthResponse }
  | { kind: "error"; message: string };

/**
 * Home.
 *
 * For Phase 1 this doubles as the end-to-end proof that the stack is wired
 * up: React → /api/health → Hono → D1 → back. Once the catalogue lands in
 * Phase 2 this becomes the discovery feed and the status panel goes away.
 */
export function Home() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((health) => {
        if (!cancelled) setState({ kind: "ready", health });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Could not reach the Drank API.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <section className="rounded-card bg-surface px-5 py-8 text-center shadow-card">
        <Logo size="lg" />
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
          Collect, rate and discover soft drinks. Think Discogs, but fizzy.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="status-heading">
        <h2
          id="status-heading"
          className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint"
        >
          Foundation status
        </h2>

        {state.kind === "loading" && <LoadingState label="Checking the API" />}

        {state.kind === "error" && (
          <ErrorState
            title="API unreachable"
            message={state.message}
            onRetry={() => window.location.reload()}
          />
        )}

        {state.kind === "ready" && (
          <dl className="mt-2 divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-card">
            <Row label="API" value={state.health.status} />
            <Row label="Database" value={state.health.database} />
            <Row
              label="Drinks in catalogue"
              value={String(state.health.publishedDrinks)}
            />
            <Row label="Query time" value={`${state.health.latencyMs} ms`} />
          </dl>
        )}
      </section>

      <p className="mt-6 px-1 text-xs leading-relaxed text-ink-faint">
        Phase 1 is the foundation only. The catalogue, search, collections and
        ratings arrive in later phases.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
