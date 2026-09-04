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
            err instanceof Error ? err.message : "Could not reach the Drank API.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <section className="sticker-lg bg-fizz px-5 py-8 text-center">
        <Logo size="lg" />
        <p className="mx-auto mt-4 max-w-[16rem] text-sm font-medium leading-relaxed text-ink">
          Collect, rate and discover soft drinks. Think Discogs, but fizzy.
        </p>
      </section>

      <section className="mt-7" aria-labelledby="status-heading">
        <h2 id="status-heading" className="eyebrow px-1">
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
          <dl className="sticker mt-3 divide-y-[2.5px] divide-ink overflow-hidden">
            <Row label="API" value={state.health.status} tone="bg-lime" />
            <Row label="Database" value={state.health.database} tone="bg-lime" />
            <Row
              label="Drinks in catalogue"
              value={String(state.health.publishedDrinks)}
              tone="bg-citrus"
            />
            <Row
              label="Query time"
              value={`${state.health.latencyMs} ms`}
              tone="bg-berry"
            />
          </dl>
        )}
      </section>

      <p className="mt-6 px-1 text-xs leading-relaxed text-ink-muted">
        Phase 1 is the foundation only. The catalogue, search, collections and
        ratings arrive in later phases.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-sm font-medium text-ink-muted">{label}</dt>
      <dd
        className={`sticker-sm shrink-0 px-2.5 py-1 font-display text-sm text-ink ${tone}`}
      >
        {value}
      </dd>
    </div>
  );
}
