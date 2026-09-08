import { usePageTitle } from "../usePageTitle";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { DrinkSummary } from "../../shared/types";
import { getDrinks } from "../api";
import { DrinkGrid } from "../components/DrinkGrid";
import { Logo } from "../components/Logo";
import { ErrorState, LoadingState } from "../components/States";

interface Feeds {
  recent: DrinkSummary[];
  topRated: DrinkSummary[];
}

/**
 * Home — the discovery feed.
 *
 * Two shelves for now: newest additions and the best rated. The brief lists
 * trending, hidden gems and random as later discovery ideas; those need usage
 * data or a wider catalogue to be meaningful, so they are not built yet.
 */
export function Home() {
  usePageTitle("Drank");
  const [feeds, setFeeds] = useState<Feeds | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getDrinks({ sort: "recent", limit: 6 }, controller.signal),
      getDrinks({ sort: "rating", limit: 6 }, controller.signal),
    ])
      .then(([recent, topRated]) => {
        setFeeds({ recent: recent.items, topRated: topRated.items });
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not reach the Drank API.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  return (
    <div>
      <section className="sticker-lg bg-fizz px-5 py-7 text-center">
        <Logo size="lg" />
        <p className="mx-auto mt-4 max-w-[16rem] text-sm font-medium leading-relaxed text-ink">
          Collect, rate and discover soft drinks. Think Discogs, but fizzy.
        </p>
        <Link to="/discover" className="btn btn-citrus mt-5">
          Browse the catalogue
        </Link>
      </section>

      {status === "loading" && <LoadingState label="Loading drinks" />}

      {status === "error" && (
        <ErrorState
          title="Could not load drinks"
          message={errorMessage}
          onRetry={() => window.location.reload()}
        />
      )}

      {status === "ready" && feeds && (
        <>
          <Shelf
            title="Just added"
            drinks={feeds.recent}
            seeAllTo="/discover?sort=recent"
          />
          <Shelf
            title="Top rated"
            drinks={feeds.topRated}
            seeAllTo="/discover?sort=rating"
          />
        </>
      )}
    </div>
  );
}

function Shelf({
  title,
  drinks,
  seeAllTo,
}: {
  title: string;
  drinks: DrinkSummary[];
  seeAllTo: string;
}) {
  if (drinks.length === 0) return null;
  const headingId = `shelf-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section className="mt-7" aria-labelledby={headingId}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 id={headingId} className="eyebrow">
          {title}
        </h2>
        <Link
          to={seeAllTo}
          className="text-xs font-semibold text-ink underline underline-offset-2"
        >
          See all
        </Link>
      </div>
      <DrinkGrid drinks={drinks} label={title} />
    </section>
  );
}
