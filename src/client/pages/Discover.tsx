import { usePageTitle } from "../usePageTitle";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { DrinkSummary, Facets } from "../../shared/types";
import { getDrinks, getFacets, type DrinkQuery } from "../api";
import { DrinkGrid } from "../components/DrinkGrid";
import { SearchBar } from "../components/SearchBar";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { countryName, humanise } from "../format";

type Sort = "recent" | "rating" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Newest" },
  { value: "rating", label: "Top rated" },
  { value: "name", label: "A–Z" },
];

/**
 * Discover — browse, search and filter the catalogue.
 *
 * Filter state lives in the URL rather than component state, so a filtered
 * view can be shared, survives a refresh, and the back button behaves the way
 * people expect on a phone.
 */
export function Discover() {
  const [params, setParams] = useSearchParams();
  usePageTitle("Discover");

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const country = params.get("country") ?? "";
  const sort = (params.get("sort") as Sort | null) ?? "recent";

  const [facets, setFacets] = useState<Facets | null>(null);
  const [items, setItems] = useState<DrinkSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  /** Writes a filter to the URL, resetting to the first page. */
  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      // Replace, so typing in the search box does not fill the back stack.
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    getFacets(controller.signal)
      .then(setFacets)
      .catch(() => {
        // Filters are an enhancement; the grid works without them.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    const query: DrinkQuery = {
      q: q || undefined,
      category: category || undefined,
      country: country || undefined,
      sort,
    };

    getDrinks(query, controller.signal)
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not load drinks.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [q, category, country, sort]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getDrinks({
        q: q || undefined,
        category: category || undefined,
        country: country || undefined,
        sort,
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

  const hasFilters = Boolean(q || category || country);

  return (
    <div>
      <SearchBar value={q} onChange={(value) => setParam("q", value)} />

      {/* Sort. A segmented control rather than a dropdown: three options are
          faster to hit with a thumb than a select. */}
      <div
        role="group"
        aria-label="Sort drinks"
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
      >
        {SORTS.map((option) => {
          const active = sort === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setParam("sort", option.value)}
              className={[
                "sticker-sm min-h-9 shrink-0 px-3 font-display text-xs",
                active ? "bg-citrus" : "bg-surface",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {facets && facets.categories.length > 0 && (
        <div
          role="group"
          aria-label="Filter by category"
          className="mt-2 flex gap-2 overflow-x-auto pb-1"
        >
          <FilterChip
            label="All"
            active={category === ""}
            onClick={() => setParam("category", "")}
          />
          {facets.categories.map((facet) => (
            <FilterChip
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
      )}

      {facets && facets.countries.length > 0 && (
        <div className="mt-2">
          <label
            htmlFor="country-filter"
            className="eyebrow mb-1 block px-1"
          >
            Country
          </label>
          <select
            id="country-filter"
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
        {status === "loading" && <LoadingState label="Finding drinks" />}

        {status === "error" && (
          <ErrorState message={errorMessage} onRetry={() => setParam("_", "")} />
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState
            icon="🔍"
            tone="bg-fizz"
            title="No drinks found"
            description={
              hasFilters
                ? "Nothing matches those filters. Try a different search or clear them."
                : "The catalogue is empty."
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn btn-citrus"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <p aria-live="polite" className="mb-3 px-1 text-xs font-medium text-ink-muted">
              {total.toLocaleString("en-GB")}{" "}
              {total === 1 ? "drink" : "drinks"}
              {hasFilters ? " matching" : " in the catalogue"}
            </p>

            <DrinkGrid drinks={items} label="Drinks" />

            {nextCursor && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-cherry disabled:opacity-60"
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

function FilterChip({
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
