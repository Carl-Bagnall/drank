import { useState } from "react";
import { useNavigate } from "react-router";
import type { CollectionStatus } from "../../shared/types";
import * as api from "../api";
import { useAuth } from "../auth";

/**
 * Move a drink between "not on a list", "on my wantlist" and "in my
 * collection".
 *
 * The three states are mutually exclusive — one row per user per drink — so
 * this is a single control with three shapes rather than two independent
 * toggles that could contradict each other.
 *
 * Removing from the collection also withdraws the rating, because a rating
 * now means "I have tried this". The button says so before it happens.
 */
export function CollectButton({
  drinkId,
  status,
  onChange,
}: {
  drinkId: string;
  status: CollectionStatus | null;
  /** Reports the new status, and whether this was a fresh collect. */
  onChange: (status: CollectionStatus | null, justCollected: boolean) => void;
}) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <button
        type="button"
        className="btn btn-cherry w-full"
        onClick={() => navigate("/signin", { state: { from: `/drinks/${drinkId}` } })}
      >
        Sign in to collect
      </button>
    );
  }

  async function run(action: () => Promise<void>, next: CollectionStatus | null) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      onChange(next, next === "collected" && status !== "collected");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update your lists.",
      );
    } finally {
      setBusy(false);
    }
  }

  const collect = () =>
    run(() => api.addToCollection(drinkId, "collected").then(() => undefined), "collected");
  const want = () =>
    run(() => api.addToCollection(drinkId, "wanted").then(() => undefined), "wanted");
  const remove = () =>
    run(() => api.removeFromCollection(drinkId).then(() => undefined), null);

  return (
    <div>
      {status === null && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={collect}
            disabled={busy}
            className="btn btn-cherry w-full disabled:opacity-70"
          >
            I've tried this
          </button>
          <button
            type="button"
            onClick={want}
            disabled={busy}
            className="btn w-full disabled:opacity-70"
          >
            ☆ Add to wantlist
          </button>
        </div>
      )}

      {status === "wanted" && (
        <div className="flex flex-col gap-2">
          <p className="sticker-sm bg-citrus px-3 py-2 text-center text-sm font-semibold text-ink">
            ☆ On your wantlist
          </p>
          <button
            type="button"
            onClick={collect}
            disabled={busy}
            className="btn btn-cherry w-full disabled:opacity-70"
          >
            I've tried this
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="btn w-full disabled:opacity-70"
          >
            Remove from wantlist
          </button>
        </div>
      )}

      {status === "collected" && (
        <div className="flex flex-col gap-2">
          {/* A tick as well as a colour change, so the state is not carried by
              colour alone. */}
          <p className="sticker-sm bg-lime px-3 py-2 text-center text-sm font-semibold text-ink">
            ✓ In your collection
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="btn w-full disabled:opacity-70"
          >
            Remove — this also deletes your rating
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-xs font-semibold text-cherry-dark">
          {error}
        </p>
      )}
    </div>
  );
}
