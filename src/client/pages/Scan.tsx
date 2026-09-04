import { EmptyState } from "../components/States";

/**
 * Scan.
 *
 * Barcode scanning is not implemented yet, and the brief is explicit that this
 * screen must explain itself rather than present a broken interaction. So this
 * is an honest "not yet" with the intended flow spelled out, not a dead button.
 */
export function Scan() {
  const steps = [
    "Point your camera at a barcode",
    "We look the product up",
    "Confirm the match",
    "Add it to your collection",
    "Rate it",
  ];

  return (
    <div>
      <EmptyState
        icon="📷"
        tone="bg-cherry"
        title="Scanning is coming soon"
        description="Barcode scanning arrives in Phase 5, along with Open Food Facts lookup."
      />

      <section aria-labelledby="scan-plan-heading" className="sticker px-5 py-5">
        <h2 id="scan-plan-heading" className="eyebrow">
          How it will work
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="sticker-sm flex size-7 shrink-0 items-center justify-center bg-fizz font-display text-xs text-ink"
              >
                {index + 1}
              </span>
              <span className="text-sm font-medium text-ink">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t-[2.5px] border-dashed border-ink pt-4 text-xs leading-relaxed text-ink-muted">
          If a barcode is not recognised that is not an error — you will be
          offered the option to create the drink manually.
        </p>
      </section>
    </div>
  );
}
