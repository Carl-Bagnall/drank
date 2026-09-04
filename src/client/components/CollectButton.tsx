import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import * as api from "../api";

/**
 * Add or remove a drink from the signed-in user's collection.
 *
 * Optimistic: the label flips immediately and rolls back if the request
 * fails, because on a phone in a shop the round trip is the slow part and
 * waiting for it makes the app feel broken.
 *
 * Signed-out users are sent to sign in and returned to this drink afterwards,
 * rather than being shown a dead control.
 */
export function CollectButton({
  drinkId,
  initiallyCollected,
  onChange,
}: {
  drinkId: string;
  initiallyCollected: boolean;
  onChange?: (collected: boolean) => void;
}) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [collected, setCollected] = useState(initiallyCollected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <button
        type="button"
        className="btn btn-cherry w-full"
        onClick={() =>
          navigate("/signin", { state: { from: `/drinks/${drinkId}` } })
        }
      >
        Sign in to collect
      </button>
    );
  }

  async function toggle() {
    if (busy) return;
    const next = !collected;

    setBusy(true);
    setError("");
    setCollected(next);
    onChange?.(next);

    try {
      if (next) {
        await api.addToCollection(drinkId);
      } else {
        await api.removeFromCollection(drinkId);
      }
      await refresh();
    } catch (err) {
      // Put the button back the way it was — the server disagreed.
      setCollected(!next);
      onChange?.(!next);
      setError(
        err instanceof Error ? err.message : "Could not update your collection.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={collected}
        className={[
          "btn w-full disabled:opacity-70",
          collected ? "bg-lime" : "btn-cherry",
        ].join(" ")}
      >
        {/* A tick as well as a colour change, so the state is not carried by
            colour alone. */}
        {collected ? "✓ In your collection" : "Add to collection"}
      </button>

      {collected && (
        <p className="mt-2 text-center text-xs font-medium text-ink-muted">
          Tap again to remove it.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-xs font-semibold text-cherry-dark">
          {error}
        </p>
      )}
    </div>
  );
}
