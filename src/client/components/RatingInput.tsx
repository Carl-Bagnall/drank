import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  RATING_MAX,
  RATING_MAX_TENTHS,
  RATING_MIN,
  RATING_MIN_TENTHS,
  RATING_STEP,
  formatRating,
} from "../../shared/rating";
import * as api from "../api";
import { useAuth } from "../auth";

/**
 * Rate a drink from 0 to 10, in steps of 0.1.
 *
 * Rating a drink means having tried it, so saving a score also puts the drink
 * in the viewer's collection — promoting it from the wantlist if it was
 * there. The control is therefore offered on any drink, but using it is never
 * neutral: it is how a drink gets collected without pressing the other button.
 *
 * The slider is for choosing roughly; the −/+ buttons are for landing exactly.
 * At 0.1 precision the track holds 100 steps, which is about three pixels each
 * on a phone, so dragging alone cannot reliably hit a specific value like 8.2.
 * Keyboard users get the same precision from the arrow keys natively.
 *
 * Saving is an explicit button rather than firing on every slider movement:
 * a range input emits a change per step, which would mean a request per pixel
 * dragged. It also matches how the notes panel behaves.
 */
export function RatingInput({
  drinkId,
  initialRating,
  prompt = false,
  onRated,
}: {
  drinkId: string;
  initialRating: number | null;
  /** True just after the drink was collected, to invite a score. */
  prompt?: boolean;
  onRated: () => void | Promise<void>;
}) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  // 7.5 is a neutral starting point for someone who has not rated: high
  // enough not to read as a default insult, and off the extremes.
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

  /**
   * Steps by whole tenths, so repeated nudges cannot accumulate float drift.
   *
   * Uses the updater form deliberately. Reading `value` from the closure means
   * several taps inside one React batch all see the same stale number and only
   * the last survives — tapping + quickly to get from 7.5 to 8.2 would land on
   * 7.6. The updater always sees the pending value.
   */
  function nudge(deltaTenths: number) {
    setValue((current) => {
      const tenths = Math.round(current * 10) + deltaTenths;
      return Math.min(RATING_MAX_TENTHS, Math.max(RATING_MIN_TENTHS, tenths)) / 10;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await api.setRating(drinkId, value);
      setSaved(response.viewerRating);
      await onRated();
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
      await api.deleteRating(drinkId);
      setSaved(null);
      setValue(7.5);
      await onRated();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove your rating.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = saved === null || value !== saved;

  return (
    <section
      className={[
        "mt-5 px-4 py-4",
        prompt && saved === null ? "sticker-lg bg-citrus" : "sticker",
      ].join(" ")}
      aria-labelledby="rate-heading"
    >
      <h2 id="rate-heading" className="eyebrow">
        {saved !== null
          ? "Your rating"
          : prompt
            ? "Added. How was it?"
            : "Rate this drink"}
      </h2>
      {prompt && saved === null && (
        <p className="mt-1 text-xs font-medium text-ink">
          Optional — you can skip this and rate it later.
        </p>
      )}

      <div className="mt-3 flex items-center justify-center gap-3">
        <NudgeButton
          label="Decrease rating by 0.1"
          symbol="−"
          onClick={() => nudge(-1)}
          disabled={value <= RATING_MIN}
        />

        <span className="sticker-sm min-w-[6rem] bg-lime px-3 py-2 text-center font-display text-2xl leading-none text-ink">
          {formatRating(value)}
          <span className="ml-0.5 text-xs font-medium">/ 10</span>
        </span>

        <NudgeButton
          label="Increase rating by 0.1"
          symbol="+"
          onClick={() => nudge(1)}
          disabled={value >= RATING_MAX}
        />
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
      <div
        aria-hidden="true"
        className="flex justify-between px-0.5 text-[0.625rem] font-semibold text-ink-muted"
      >
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="btn btn-cherry flex-1"
        >
          {busy ? "Saving…" : saved === null ? "Save rating" : "Update rating"}
        </button>

        {saved !== null && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="btn"
          >
            Remove
          </button>
        )}
      </div>

      <p
        aria-live="polite"
        className="mt-2 text-center text-xs font-medium text-ink-muted"
      >
        {error ? (
          <span className="text-cherry-dark">{error}</span>
        ) : saved !== null && !dirty ? (
          `Saved. You rated this ${formatRating(saved)} out of 10.`
        ) : null}
      </p>
    </section>
  );
}

function NudgeButton({
  label,
  symbol,
  onClick,
  disabled,
}: {
  label: string;
  symbol: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="sticker-sm flex size-11 shrink-0 items-center justify-center bg-surface font-display text-xl leading-none text-ink disabled:opacity-40"
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}
