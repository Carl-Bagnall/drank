import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { CommunityRating } from "../../shared/types";
import {
  RATING_MAX,
  RATING_MIN,
  RATING_STEP,
  formatRating,
} from "../../shared/rating";
import * as api from "../api";
import { useAuth } from "../auth";

/**
 * Rate a drink from 0 to 10 in half points.
 *
 * Rating is independent of collecting — the two are separate tables — so this
 * appears on any drink, whether or not the viewer owns it.
 *
 * Saving is an explicit button rather than firing on every slider movement:
 * a range input emits a change per step, which would mean a request per pixel
 * dragged. It also matches how the notes panel behaves.
 */
export function RatingInput({
  drinkId,
  initialRating,
  onRated,
}: {
  drinkId: string;
  initialRating: number | null;
  onRated: (viewerRating: number | null, community: CommunityRating) => void;
}) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  // 7.5 is a sensible neutral starting point for someone who has not rated:
  // high enough not to feel like a default insult, off the extremes.
  const [value, setValue] = useState(initialRating ?? 7.5);
  const [saved, setSaved] = useState(initialRating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(initialRating ?? 7.5);
    setSaved(initialRating);
    setError("");
  }, [drinkId, initialRating]);

  if (!user) {
    return (
      <section className="sticker mt-5 px-4 py-4" aria-labelledby="rate-heading">
        <h2 id="rate-heading" className="eyebrow">
          Rate this drink
        </h2>
        <button
          type="button"
          className="btn btn-cherry mt-3 w-full"
          onClick={() => navigate("/signin", { state: { from: `/drinks/${drinkId}` } })}
        >
          Sign in to rate
        </button>
      </section>
    );
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await api.setRating(drinkId, value);
      setSaved(response.viewerRating);
      onRated(response.viewerRating, response.community);
      // The average shown on the profile and collection is derived from the
      // viewer's own scores, so it moves when this does.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your rating.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await api.deleteRating(drinkId);
      setSaved(null);
      setValue(7.5);
      onRated(null, response.community);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove your rating.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = saved === null || value !== saved;

  return (
    <section className="sticker mt-5 px-4 py-4" aria-labelledby="rate-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rate-heading" className="eyebrow">
          {saved === null ? "Rate this drink" : "Your rating"}
        </h2>
        <span className="sticker-sm bg-lime px-3 py-1 font-display text-lg leading-none text-ink">
          {formatRating(value)}
          <span className="ml-0.5 text-xs font-medium">/ 10</span>
        </span>
      </div>

      <label htmlFor="rating" className="sr-only">
        Your rating out of 10
      </label>
      <input
        id="rating"
        type="range"
        className="rating-slider mt-2"
        min={RATING_MIN}
        max={RATING_MAX}
        step={RATING_STEP}
        value={value}
        // Without this a screen reader reads a bare number; this makes the
        // scale explicit at every step.
        aria-valuetext={`${formatRating(value)} out of 10`}
        onChange={(event) => setValue(Number(event.target.value))}
      />

      {/* Endpoint labels, so the scale is readable without dragging. */}
      <div aria-hidden="true" className="flex justify-between px-0.5 text-[0.625rem] font-semibold text-ink-muted">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="btn btn-cherry flex-1 disabled:opacity-50"
        >
          {busy ? "Saving…" : saved === null ? "Save rating" : "Update rating"}
        </button>

        {saved !== null && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="btn disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      <p aria-live="polite" className="mt-2 text-center text-xs font-medium text-ink-muted">
        {error ? (
          <span className="text-cherry-dark">{error}</span>
        ) : saved !== null && !dirty ? (
          `Saved. You rated this ${formatRating(saved)} out of 10.`
        ) : null}
      </p>
    </section>
  );
}
