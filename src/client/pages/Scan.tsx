import { usePageTitle } from "../usePageTitle";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import * as api from "../api";
import {
  checkScanSupport,
  startScanning,
  type ScannerHandle,
} from "../barcodeScanner";
import { ErrorState } from "../components/States";

type Phase =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "looking-up"; barcode: string }
  | { kind: "error"; message: string };

/**
 * Scan a barcode, or type one in.
 *
 * The three outcomes are all treated as normal, per the brief: the drink is
 * already catalogued, an external provider recognised it, or nobody knows it.
 * Only the last needs the user to type anything, and even then they land on a
 * form with the barcode already filled.
 *
 * Manual entry is always available, not a fallback shown only on failure —
 * iPhones cannot scan at all, and a scuffed barcode defeats any decoder.
 */
export function Scan() {
  const navigate = useNavigate();
  usePageTitle("Scan a barcode");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [manual, setManual] = useState("");
  const [support] = useState(() => checkScanSupport());

  // Release the camera on unmount. Leaving it running keeps the indicator
  // light on, which looks like the app is spying.
  useEffect(() => () => scannerRef.current?.stop(), []);

  async function lookUp(barcode: string) {
    setPhase({ kind: "looking-up", barcode });
    try {
      const result = await api.lookupBarcode(barcode);

      if (result.status === "in_catalogue") {
        navigate(`/drinks/${result.drink.id}`);
        return;
      }

      // Both remaining outcomes go to the same form. A suggestion prefills it;
      // an unknown barcode just fills the barcode field.
      navigate("/drinks/new", {
        state:
          result.status === "suggestion"
            ? { suggestion: result.suggestion }
            : { barcode: result.barcode, providerAvailable: result.providerAvailable },
      });
    } catch (err) {
      setPhase({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not look that barcode up.",
      });
    }
  }

  async function beginScanning() {
    setPhase({ kind: "scanning" });
    const video = videoRef.current;
    if (!video) return;

    scannerRef.current = await startScanning(
      video,
      (barcode) => void lookUp(barcode),
      (message) => setPhase({ kind: "error", message }),
    );
  }

  function stopScanning() {
    scannerRef.current?.stop();
    scannerRef.current = null;
    setPhase({ kind: "idle" });
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const barcode = manual.trim();
    if (barcode) void lookUp(barcode);
  }

  return (
    <div>
      <header className="sticker-lg bg-cherry px-5 py-5">
        <h1 className="text-2xl text-ink">Scan a barcode</h1>
        <p className="mt-1 text-sm font-medium text-ink">
          Point your camera at a can or bottle, or type the number underneath it.
        </p>
      </header>

      {/* Camera */}
      <section className="mt-5" aria-labelledby="camera-heading">
        <h2 id="camera-heading" className="eyebrow px-1">
          Camera
        </h2>

        {support.supported ? (
          <div className="sticker mt-2 overflow-hidden">
            <div className="relative aspect-[4/3] bg-shade">
              <video
                ref={videoRef}
                className="size-full object-cover"
                // Decorative: the barcode result is announced by the page.
                aria-hidden="true"
              />
              {phase.kind !== "scanning" && (
                <div className="absolute inset-0 flex items-center justify-center bg-shade">
                  <span className="text-4xl" aria-hidden="true">
                    📷
                  </span>
                </div>
              )}
              {phase.kind === "scanning" && (
                // A frame to aim with. Purely visual.
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-8 inset-y-1/3 rounded-lg border-[3px] border-citrus"
                />
              )}
            </div>

            <div className="px-4 py-3">
              {phase.kind === "scanning" ? (
                <button type="button" onClick={stopScanning} className="btn w-full">
                  Stop camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={beginScanning}
                  disabled={phase.kind === "looking-up"}
                  className="btn btn-cherry w-full"
                >
                  Start camera
                </button>
              )}
              <p aria-live="polite" className="mt-2 text-center text-xs font-medium text-ink-muted">
                {phase.kind === "scanning" && "Hold the barcode steady in the frame…"}
                {phase.kind === "looking-up" && `Looking up ${phase.barcode}…`}
              </p>
            </div>
          </div>
        ) : (
          <div className="sticker mt-2 px-4 py-4">
            <p className="text-sm leading-relaxed text-ink-muted">{support.reason}</p>
          </div>
        )}
      </section>

      {/* Manual entry — always present, never hidden behind a failure. */}
      <section className="mt-6" aria-labelledby="manual-heading">
        <h2 id="manual-heading" className="eyebrow px-1">
          Or type the number
        </h2>
        <form onSubmit={submitManual} className="sticker mt-2 px-4 py-4">
          <label htmlFor="barcode" className="sr-only">
            Barcode number
          </label>
          <input
            id="barcode"
            type="text"
            // `numeric` gives a digits keypad without the spinner and
            // scroll-to-change behaviour of type="number".
            inputMode="numeric"
            pattern="\d*"
            autoComplete="off"
            placeholder="e.g. 5000112611861"
            value={manual}
            onChange={(event) => setManual(event.target.value.replace(/\D/g, ""))}
            className="sticker-sm min-h-11 w-full bg-surface px-3 text-base font-medium text-ink placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={manual.trim().length < 8 || phase.kind === "looking-up"}
            className="btn btn-citrus mt-3 w-full"
          >
            {phase.kind === "looking-up" ? "Looking up…" : "Look up barcode"}
          </button>
          <p className="mt-2 text-center text-xs text-ink-muted">
            8 to 14 digits, printed under the bars.
          </p>
        </form>
      </section>

      {phase.kind === "error" && (
        <ErrorState
          title="Could not scan"
          message={phase.message}
          onRetry={() => setPhase({ kind: "idle" })}
        />
      )}

      <p className="mt-6 px-1 text-center text-xs leading-relaxed text-ink-muted">
        Not found? You can add the drink yourself — that is how the catalogue grows.
      </p>
    </div>
  );
}
