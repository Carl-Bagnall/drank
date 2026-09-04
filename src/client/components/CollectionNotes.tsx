import { useEffect, useState } from "react";
import * as api from "../api";

/**
 * Personal notes and favourite status for a drink the viewer has collected.
 *
 * Shown only when the drink is in their collection — the brief asks for notes
 * "if collected", and an editor for something you do not own would be
 * confusing.
 */
export function CollectionNotes({
  drinkId,
  initialNotes,
  initialFavourite,
}: {
  drinkId: string;
  initialNotes: string | null;
  initialFavourite: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [favourite, setFavourite] = useState(initialFavourite);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  // Reset when navigating between drinks without unmounting.
  useEffect(() => {
    setNotes(initialNotes ?? "");
    setSavedNotes(initialNotes ?? "");
    setFavourite(initialFavourite);
    setStatus("idle");
  }, [drinkId, initialNotes, initialFavourite]);

  async function save(changes: { notes?: string; isFavourite?: boolean }) {
    setStatus("saving");
    setError("");
    try {
      await api.updateCollectionEntry(drinkId, changes);
      if (changes.notes !== undefined) setSavedNotes(changes.notes);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  const dirty = notes !== savedNotes;

  return (
    <section className="sticker mt-5 px-4 py-4" aria-labelledby="notes-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notes-heading" className="eyebrow">
          Your notes
        </h2>
        <button
          type="button"
          aria-pressed={favourite}
          onClick={() => {
            const next = !favourite;
            setFavourite(next);
            void save({ isFavourite: next });
          }}
          className={[
            "sticker-sm min-h-9 px-3 text-xs font-semibold",
            favourite ? "bg-citrus" : "bg-surface",
          ].join(" ")}
        >
          {favourite ? "★ Favourite" : "☆ Mark favourite"}
        </button>
      </div>

      <label htmlFor="notes" className="sr-only">
        Your notes about this drink
      </label>
      <textarea
        id="notes"
        value={notes}
        maxLength={2000}
        rows={3}
        placeholder="Where you found it, what it tasted like…"
        onChange={(event) => setNotes(event.target.value)}
        className="sticker-sm mt-3 w-full resize-y bg-surface px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-faint"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || status === "saving"}
          onClick={() => void save({ notes })}
          className="btn btn-citrus disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save notes"}
        </button>

        <p aria-live="polite" className="text-xs font-medium text-ink-muted">
          {status === "saved" && !dirty && "Saved."}
          {status === "error" && <span className="text-cherry-dark">{error}</span>}
        </p>
      </div>
    </section>
  );
}
