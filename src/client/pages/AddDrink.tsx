import { usePageTitle } from "../usePageTitle";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { NewDrinkInput, ProductSuggestion } from "../../shared/types";
import * as api from "../api";
import { useAuth } from "../auth";
import { DrinkImage } from "../components/DrinkImage";
import { EmptyState, LoadingState } from "../components/States";
import { humanise } from "../format";

const CATEGORIES = [
  "cola",
  "lemonade",
  "citrus",
  "fruit",
  "energy",
  "ginger_beer",
  "other",
];

const PACKAGING = [
  "can",
  "bottle_glass",
  "bottle_plastic",
  "carton",
  "pouch",
  "other",
];

const PACKAGING_LABELS: Record<string, string> = {
  can: "Can",
  bottle_glass: "Glass bottle",
  bottle_plastic: "Plastic bottle",
  carton: "Carton",
  pouch: "Pouch",
  other: "Other",
};

interface RouteState {
  suggestion?: ProductSuggestion;
  barcode?: string;
  providerAvailable?: boolean;
}

/**
 * Add a drink to the catalogue.
 *
 * Only name and brand are required. Everything else is optional and the form
 * says so, because the brief is explicit that a contribution may be little
 * more than a name and a brand — and a form that demands more just means
 * people invent answers.
 *
 * Arrives either empty, or prefilled from a barcode lookup. Prefilled values
 * are always editable: an external provider suggests, it never decides.
 */
export function AddDrink() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as RouteState;
  usePageTitle("Add a drink");

  const suggestion = state.suggestion;

  const [name, setName] = useState(suggestion?.name ?? "");
  const [brand, setBrand] = useState(suggestion?.brand ?? "");
  const [flavour, setFlavour] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState(suggestion?.country ?? "");
  const [volumeMl, setVolumeMl] = useState(
    suggestion?.volumeMl ? String(suggestion.volumeMl) : "",
  );
  const [packaging, setPackaging] = useState("");
  const [barcode] = useState(suggestion?.barcode ?? state.barcode ?? "");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState(suggestion?.imageUrl ?? "");

  const [existing, setExisting] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /**
   * Shows what already exists under this brand, so somebody adding
   * "Coca-Cola Cherry" can see they meant the one already there. Never blocks:
   * variants are genuinely separate drinks.
   */
  useEffect(() => {
    const trimmed = brand.trim();
    if (trimmed.length < 2) {
      setExisting([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .getBrandDrinks(trimmed, controller.signal)
        .then((response) => setExisting(response.items))
        .catch(() => setExisting([]));
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [brand]);

  if (loading) return <LoadingState label="Checking your session" />;

  if (!user) {
    return (
      <EmptyState
        icon="✏️"
        tone="bg-fizz"
        title="Sign in to add a drink"
        description="Contributions are credited, so adding to the catalogue needs an account."
        action={
          <Link to="/signin" state={{ from: "/drinks/new" }} className="btn btn-cherry">
            Sign in
          </Link>
        }
      />
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const input: NewDrinkInput = {
      name,
      brand,
      flavour: flavour || null,
      category: category || null,
      country: country || null,
      volumeMl: volumeMl ? Number(volumeMl) : null,
      packaging: packaging || null,
      barcode: barcode || null,
      description: description || null,
      imageUrl: imageUrl || null,
      // Recorded so the catalogue knows where a value came from, without ever
      // treating the provider as authoritative.
      externalSource: suggestion?.source ?? null,
      externalSourceId: suggestion?.sourceId ?? null,
    };

    try {
      const { id } = await api.createDrink(input);
      navigate(`/drinks/${id}`, { replace: true });
    } catch (err) {
      const duplicateBarcode =
        err instanceof api.ApiRequestError &&
        err.code === "already_exists" &&
        Boolean(barcode);

      // A duplicate barcode is not a dead end. The catalogue already has that
      // drink, so look it up once more — which now resolves to it — and go
      // there, rather than leaving someone stuck on a form they cannot submit.
      if (duplicateBarcode) {
        try {
          const found = await api.lookupBarcode(barcode);
          if (found.status === "in_catalogue") {
            navigate(`/drinks/${found.drink.id}`, { replace: true });
            return;
          }
        } catch {
          // Fall through to the message below.
        }
      }

      setError(err instanceof Error ? err.message : "Could not add this drink.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="sticker-lg bg-fizz px-5 py-5">
        <h1 className="text-2xl text-ink">Add a drink</h1>
        <p className="mt-1 text-sm font-medium text-ink">
          {suggestion
            ? "Found it. Check the details and change anything that looks wrong."
            : state.barcode
              ? state.providerAvailable === false
                ? "Barcode lookup is unavailable right now, so add it by hand."
                : "No drink found for that barcode. Add it and it joins the catalogue."
              : "Only a name and a brand are needed."}
        </p>
      </header>

      {suggestion && (
        <section className="sticker mt-4 flex items-center gap-3 px-3 py-3">
          <div className="w-16 shrink-0 overflow-hidden rounded-[10px] border-2 border-ink">
            <DrinkImage
              drinkId={suggestion.sourceId}
              name={suggestion.name ?? "Suggested product"}
              brand={suggestion.brand ?? ""}
              imageUrl={suggestion.imageUrl}
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            Suggested by Open Food Facts. Nothing is saved until you press add,
            and every field is yours to change.
          </p>
        </section>
      )}

      <form onSubmit={handleSubmit} className="sticker mt-4 px-4 py-5">
        <Field id="name" label="Name" required value={name} onChange={setName} />
        <Field id="brand" label="Brand" required value={brand} onChange={setBrand} />

        {existing.length > 0 && (
          <div className="sticker-sm mb-4 bg-citrus px-3 py-2.5">
            <p className="text-xs font-semibold text-ink">
              Already in the catalogue under this brand:
            </p>
            <ul className="mt-1.5 space-y-1">
              {existing.map((drink) => (
                <li key={drink.id}>
                  <Link
                    to={`/drinks/${drink.id}`}
                    className="text-xs font-medium text-ink underline underline-offset-2"
                  >
                    {drink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="eyebrow mb-3 mt-1">Everything below is optional</p>

        <Field id="flavour" label="Flavour" value={flavour} onChange={setFlavour} />

        <SelectField
          id="category"
          label="Category"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((value) => ({ value, label: humanise(value) }))}
        />

        <Field
          id="country"
          label="Country code"
          value={country}
          onChange={(value) => setCountry(value.toUpperCase().slice(0, 2))}
          hint="Two letters, e.g. GB"
        />

        <Field
          id="volumeMl"
          label="Volume (ml)"
          value={volumeMl}
          inputMode="numeric"
          onChange={(value) => setVolumeMl(value.replace(/\D/g, ""))}
        />

        <SelectField
          id="packaging"
          label="Packaging"
          value={packaging}
          onChange={setPackaging}
          options={PACKAGING.map((value) => ({
            value,
            label: PACKAGING_LABELS[value] ?? humanise(value),
          }))}
        />

        <Field
          id="imageUrl"
          label="Image URL"
          value={imageUrl}
          onChange={setImageUrl}
          hint="Must start with http:// or https://"
        />

        <div className="mb-4">
          <label htmlFor="description" className="eyebrow mb-1.5 block">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="sticker-sm w-full resize-y bg-surface px-3 py-2 text-sm font-medium text-ink"
          />
        </div>

        {barcode && (
          <p className="sticker-sm mb-4 bg-sunken px-3 py-2 text-xs font-medium text-ink">
            Barcode {barcode} will be saved with this drink.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="sticker-sm mb-4 bg-cherry px-3 py-2 text-sm font-semibold text-ink"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !brand.trim()}
          className="btn btn-cherry w-full"
        >
          {submitting ? "Adding…" : "Add to the catalogue"}
        </button>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  hint,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  inputMode?: "numeric" | "text";
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="eyebrow mb-1.5 block">
        {label}
        {required && <span className="ml-1 text-cherry-dark">*</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        required={required}
        aria-describedby={hintId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sticker-sm min-h-11 w-full bg-surface px-3 text-base font-medium text-ink"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: ReactNode }[];
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="eyebrow mb-1.5 block">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sticker-sm min-h-11 w-full bg-surface px-3 text-sm font-medium text-ink"
      >
        <option value="">Not sure</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
