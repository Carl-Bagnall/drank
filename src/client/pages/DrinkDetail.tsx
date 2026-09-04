import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { DrinkDetailResponse } from "../../shared/types";
import { getDrink } from "../api";
import { DrinkImage } from "../components/DrinkImage";
import { DrinkGrid } from "../components/DrinkGrid";
import { RatingBadge } from "../components/Rating";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { countryName, humanise } from "../format";

const PACKAGING_LABELS: Record<string, string> = {
  can: "Can",
  bottle_glass: "Glass bottle",
  bottle_plastic: "Plastic bottle",
  carton: "Carton",
  pouch: "Pouch",
  other: "Other",
};

const SUGAR_LABELS: Record<string, string> = {
  full_sugar: "Full sugar",
  reduced_sugar: "Reduced sugar",
  zero_sugar: "Zero sugar",
  unknown: "Unknown",
};

const CAFFEINE_LABELS: Record<string, string> = {
  caffeinated: "Caffeinated",
  caffeine_free: "Caffeine free",
  unknown: "Unknown",
};

export function DrinkDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DrinkDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setStatus("loading");

    getDrink(id, controller.signal)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const notFound =
          typeof err === "object" &&
          err !== null &&
          "status" in err &&
          (err as { status: number }).status === 404;
        if (notFound) {
          setStatus("missing");
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : "Could not load this drink.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [id]);

  if (status === "loading") return <LoadingState label="Loading drink" />;

  if (status === "missing") {
    return (
      <EmptyState
        icon="🫙"
        tone="bg-tang"
        title="Drink not found"
        description="This drink is not in the catalogue. It may have been removed or merged."
        action={
          <Link to="/discover" className="btn btn-cherry">
            Browse the catalogue
          </Link>
        }
      />
    );
  }

  if (status === "error" || !data) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const { drink, community, siblings, viewerRating } = data;

  const facts: { label: string; value: string }[] = [];
  if (drink.flavour) facts.push({ label: "Flavour", value: drink.flavour });
  if (drink.category)
    facts.push({ label: "Category", value: humanise(drink.category) });
  if (drink.country)
    facts.push({ label: "Country", value: countryName(drink.country) });
  if (drink.region) facts.push({ label: "Region", value: drink.region });
  if (drink.volumeMl) facts.push({ label: "Volume", value: `${drink.volumeMl} ml` });
  if (drink.packaging)
    facts.push({
      label: "Packaging",
      value: PACKAGING_LABELS[drink.packaging] ?? humanise(drink.packaging),
    });
  if (drink.sugarStatus)
    facts.push({
      label: "Sugar",
      value: SUGAR_LABELS[drink.sugarStatus] ?? humanise(drink.sugarStatus),
    });
  if (drink.caffeineStatus)
    facts.push({
      label: "Caffeine",
      value: CAFFEINE_LABELS[drink.caffeineStatus] ?? humanise(drink.caffeineStatus),
    });
  if (drink.barcode) facts.push({ label: "Barcode", value: drink.barcode });

  return (
    <article>
      <div className="sticker-lg overflow-hidden">
        <div className="border-b-[3px] border-ink">
          <DrinkImage
            drinkId={drink.id}
            name={drink.name}
            brand={drink.brand}
            category={drink.category}
            imageUrl={drink.imageUrl}
            size="lg"
          />
        </div>

        <div className="px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {drink.brand}
          </p>
          <h1 className="mt-1 text-2xl leading-tight text-ink">{drink.name}</h1>

          {/* The brief requires the two ratings to read as separate things, so
              they sit side by side with explicit labels. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <RatingBadge
              score={community.average}
              count={community.count}
              label="Community"
              size="lg"
            />
            <RatingBadge
              score={viewerRating}
              label="Your rating"
              tone="bg-lime"
              size="lg"
            />
          </div>

          <div className="mt-4">
            <button type="button" disabled className="btn w-full opacity-60">
              Add to collection
            </button>
            <p className="mt-2 text-center text-xs font-medium text-ink-muted">
              Collections and ratings arrive with accounts in Phase 3.
            </p>
          </div>
        </div>
      </div>

      {drink.description && (
        <section className="sticker mt-5 px-4 py-4">
          <h2 className="eyebrow">About</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {drink.description}
          </p>
        </section>
      )}

      {facts.length > 0 && (
        <section className="mt-5" aria-labelledby="details-heading">
          <h2 id="details-heading" className="eyebrow px-1">
            Details
          </h2>
          <dl className="sticker mt-2 divide-y-[2.5px] divide-ink overflow-hidden">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <dt className="text-sm font-medium text-ink-muted">{fact.label}</dt>
                <dd className="text-right text-sm font-semibold text-ink">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mt-7" aria-labelledby="siblings-heading">
          <h2 id="siblings-heading" className="eyebrow px-1">
            More from {drink.brand}
          </h2>
          <div className="mt-2">
            <DrinkGrid drinks={siblings} label={`More from ${drink.brand}`} />
          </div>
        </section>
      )}
    </article>
  );
}
