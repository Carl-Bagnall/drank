import { usePageTitle } from "../usePageTitle";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { CollectionItem } from "../../shared/types";
import * as api from "../api";
import { useAuth } from "../auth";
import { DrinkGrid } from "../components/DrinkGrid";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

/**
 * The wantlist: drinks the viewer wants to try but has not.
 *
 * Its own screen rather than a filter on Collection, because it answers a
 * different question — "what should I look for" rather than "what have I
 * had" — and because mixing the two lists in one view is exactly the
 * confusion the separate counts are there to avoid.
 *
 * Deliberately simpler than Collection: no sorting or filtering. A wantlist
 * is a shopping list, and it is short.
 */
export function Wantlist() {
  const { user, stats, loading: authLoading } = useAuth();
  usePageTitle("Wantlist");

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setStatus("loading");

    api
      .getCollection({ status: "wanted", sort: "recent" }, controller.signal)
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not load your wantlist.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [user, stats?.wantlistCount]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.getCollection({
        status: "wanted",
        sort: "recent",
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
        icon="☆"
        tone="bg-citrus"
        title="Sign in to keep a wantlist"
        description="Keep track of drinks you want to try, separately from the ones you have."
        action={
          <Link to="/signin" state={{ from: "/wantlist" }} className="btn btn-cherry">
            Sign in
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <header className="sticker-lg bg-citrus px-5 py-5">
        <h1 className="text-2xl text-ink">Wantlist</h1>
        <p className="mt-1 text-sm font-medium text-ink">
          {total === 0
            ? "Drinks you want to try."
            : `${total.toLocaleString("en-GB")} ${total === 1 ? "drink" : "drinks"} to try.`}
        </p>
        {/* Stated explicitly, because the whole point of two lists is that one
            does not quietly count towards the other. */}
        <p className="mt-2 text-xs font-medium text-ink">
          These do not count towards your collection.
        </p>
        <Link to="/collection" className="btn mt-4">
          Your collection
        </Link>
      </header>

      <div className="mt-5">
        {status === "loading" && <LoadingState label="Loading your wantlist" />}

        {status === "error" && (
          <ErrorState
            message={errorMessage}
            onRetry={() => window.location.reload()}
          />
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState
            icon="☆"
            tone="bg-citrus"
            title="Nothing on your wantlist"
            description="Found a drink you want to try but have not yet? Add it to your wantlist and it will wait here."
            action={
              <Link to="/discover" className="btn btn-cherry">
                Browse the catalogue
              </Link>
            }
          />
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <DrinkGrid drinks={items} label="Your wantlist" />

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
