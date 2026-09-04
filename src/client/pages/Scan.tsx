import { EmptyState } from "../components/States";

/**
 * Scan.
 *
 * Barcode scanning is not implemented yet, and the brief is explicit that this
 * screen must explain itself rather than present a broken interaction. So this
 * is an honest "not yet" with the intended flow spelled out, not a dead button.
 */
export function Scan() {
  return (
    <div>
      <EmptyState
        icon="📷"
        title="Scanning is coming soon"
        description="Barcode scanning arrives in Phase 5, along with Open Food Facts lookup."
      />

      <section
        aria-labelledby="scan-plan-heading"
        className="mt-2 rounded-card bg-surface px-5 py-5 shadow-card"
      >
        <h2
          id="scan-plan-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
        >
          How it will work
        </h2>
        <ol className="mt-3 space-y-2.5 text-sm text-ink-muted">
          {[
            "Point your camera at a barcode",
            "We look the product up",
            "Confirm the match",
            "Add it to your collection",
            "Rate it",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[0.6875rem] font-semibold text-ink"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          If a barcode is not recognised that is not an error — you will be
          offered the option to create the drink manually.
        </p>
      </section>
    </div>
  );
}
