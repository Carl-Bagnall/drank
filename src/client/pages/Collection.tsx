import { usePageTitle } from "../usePageTitle";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { CollectionItem, CollectionStats as Stats, Facets } from "../../shared/types";
import * as api from "../api";
import { useAuth } from "../auth";
import { CollectionStats } from "../components/CollectionStats";
import { DrinkGrid } from "../components/DrinkGrid";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { countryName, humanise } from "../format";

type Sort = "recent" | "highest" | "lowest" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
  { value: "name", label: "Name" },
];

/**
 * The user's own collection: stats, then a sortable and filterable grid.
 *
 * Filter state lives in the URL for the same reasons as Discover — shareable,
 * survives a refresh, and the back button behaves.
 */
export function Collection() {
  const { user, loading: authLoading } = useAuth();
  usePageTitle("Your collection");
  const [params, setParams] = useSearchParams();

  const sort = (params.get("sort") as Sort | null) ?? "recent";
  const category = params.get("category") ?? "";
  const country = params.get("country") ?? "";
  const favouritesOnly = params.get("favourites") === "true";

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api
      .getCollectionFacets(controller.signal)
      .then(setFacets)
      .catch(() => {
        // Filters are an enhancement; the grid works without them.
      });
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setStatus("loading");

    api
      .getCollection(
        {
          sort,
          category: category || undefined,
          country: country || undefined,
          favourites: favouritesOnly || undefined,
        },
        controller.signal,
      )
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
        setStats(page.stats);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not load your collection.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [user, sort, category, country, favouritesOnly]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getCollection({
        sort,
        category: category || undefined,
        country: country || undefined,
        favourites: favouritesOnly || undefined,
        cursor: nextCursor,
      });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not load more drinks.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (authLoading) return <LoadingState label="Checking your session" />;

  if (!user) {
    return (
      <EmptyState
        icon="🔒"
        tone="bg-citrus"
        title="Sign in to start collecting"
        description="Your collection is private to you. Create an account and start logging the drinks you have tried."
        action={
          <Link to="/signin" state={{ from: "/collection" }} className="btn btn-cherry">
            Sign in
          </Link>
        }
      />
    );
  }

  const hasFilters = Boolean(category || country || favouritesOnly);

  return (
    <div>
      {stats && <CollectionStats stats={stats} />}

      {stats && stats.wantlistCount > 0 && (
        <Link
          to="/wantlist"
          className="sticker-sm mt-3 flex items-center justify-between bg-citrus px-4 py-3 text-sm font-semibold text-ink"
        >
          <span>
            ☆ Wantlist — {stats.wantlistCount}{" "}
            {stats.wantlistCount === 1 ? "drink" : "drinks"} to try
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="mt-4">
        <label htmlFor="collection-sort" className="eyebrow mb-1 block px-1">
          Sort
        </label>
        <select
          id="collection-sort"
          value={sort}
          onChange={(event) => setParam("sort", event.target.value)}
          className="sticker-sm min-h-11 w-full bg-surface px-3 text-sm font-medium text-ink"
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip
          label="All"
          active={!hasFilters}
          onClick={() => setParams(new URLSearchParams({ sort }), { replace: true })}
        />
        <Chip
          label="★ Favourites"
          active={favouritesOnly}
          onClick={() => setParam("favourites", favouritesOnly ? "" : "true")}
        />
        {facets?.categories.map((facet) => (
          <Chip
            key={facet.value}
            label={humanise(facet.value)}
            count={facet.count}
            active={category === facet.value}
            onClick={() =>
              setParam("category", category === facet.value ? "" : facet.value)
            }
          />
        ))}
      </div>

      {facets && facets.countries.length > 1 && (
        <div className="mt-2">
          <label htmlFor="collection-country" className="eyebrow mb-1 block px-1">
            Country
          </label>
          <select
            id="collection-country"
            value={country}
            onChange={(event) => setParam("country", event.target.value)}
            className="sticker-sm min-h-11 w-full bg-surface px-3 text-sm font-medium text-ink"
          >
            <option value="">All countries</option>
            {facets.countries.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {countryName(facet.value)} ({facet.count})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5">
        {status === "loading" && <LoadingState label="Loading your collection" />}

        {status === "error" && (
          <ErrorState message={errorMessage} onRetry={() => setParam("_", "")} />
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState
            icon="🧃"
            tone="bg-lime"
            title={hasFilters ? "Nothing matches" : "Your collection is empty"}
            description={
              hasFilters
                ? "No drinks in your collection match those filters."
                : "Find a drink you have tried and add it. Variants count separately — Cherry and Vanilla are different drinks."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn btn-citrus"
                  onClick={() =>
                    setParams(new URLSearchParams({ sort }), { replace: true })
                  }
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/discover" className="btn btn-cherry">
                  Browse the catalogue
                </Link>
              )
            }
          />
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <p aria-live="polite" className="mb-3 px-1 text-xs font-medium text-ink-muted">
              Showing {items.length.toLocaleString("en-GB")} of{" "}
              {total.toLocaleString("en-GB")}
            </p>

            <DrinkGrid drinks={items} label="Your collection" />

            {nextCursor && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-cherry"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "sticker-sm min-h-9 shrink-0 px-3 text-xs font-semibold",
        active ? "bg-fizz" : "bg-surface",
      ].join(" ")}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 font-normal text-ink-muted">{count}</span>
      )}
    </button>
  );
}
