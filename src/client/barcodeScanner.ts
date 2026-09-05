/**
 * Browser barcode scanning.
 *
 * Uses the platform's own `BarcodeDetector` rather than shipping a decoder.
 * A WASM decoder would work in more browsers but costs hundreds of kilobytes
 * on an app whose whole point is being fast on a phone in a shop, and the
 * brief says not to compromise the rest of the MVP for scanning.
 *
 * Support, as of writing: Chrome and Edge on Android and ChromeOS, and
 * desktop Chrome on macOS and Windows. Not Firefox, and not Safari or any
 * iOS browser — every iOS browser uses WebKit, so iPhones cannot scan here
 * regardless of which browser is installed. Those users type the number
 * instead, which is why manual entry is a first-class path and not a
 * consolation prize.
 */

/** The formats worth trying. Retail products are EAN/UPC. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getConstructor(): BarcodeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

export type ScanSupport =
  | { supported: true }
  /** Why not, in words a person can act on. */
  | { supported: false; reason: string };

/**
 * Whether this browser can scan, and if not, why.
 *
 * Camera access needs a secure context: browsers block `getUserMedia` on
 * plain HTTP everywhere except localhost. That means a dev server reached
 * over a LAN address cannot scan, which is worth saying plainly rather than
 * letting the camera silently fail to start.
 */
export function checkScanSupport(): ScanSupport {
  if (!globalThis.isSecureContext) {
    return {
      supported: false,
      reason:
        "Your browser only allows camera access over HTTPS. Enter the barcode number instead.",
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      supported: false,
      reason: "This browser will not give the page camera access.",
    };
  }
  if (!getConstructor()) {
    return {
      supported: false,
      reason:
        "This browser cannot decode barcodes. Chrome on Android can; iPhones cannot. Enter the number instead.",
    };
  }
  return { supported: true };
}

export interface ScannerHandle {
  stop: () => void;
}

/**
 * Streams the rear camera into `video` and reports the first barcode seen.
 *
 * Polls on a timer rather than every animation frame: detection is the
 * expensive part, and a few checks a second is plenty for someone holding a
 * can still. It also keeps the phone cooler.
 */
export async function startScanning(
  video: HTMLVideoElement,
  onDetected: (barcode: string) => void,
  onError: (message: string) => void,
): Promise<ScannerHandle> {
  const Detector = getConstructor();
  if (!Detector) {
    onError("This browser cannot decode barcodes.");
    return { stop: () => undefined };
  }

  let stopped = false;
  let stream: MediaStream | null = null;
  let timer: number | undefined;

  const stop = () => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // `environment` asks for the rear camera, which is the one pointed at
      // the can. Not `exact`, so a laptop with only a front camera still works.
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch (err) {
    const denied = err instanceof Error && err.name === "NotAllowedError";
    onError(
      denied
        ? "Camera permission was refused. You can still enter the barcode number."
        : "Could not start the camera. You can still enter the barcode number.",
    );
    return { stop: () => undefined };
  }

  if (stopped) {
    stream.getTracks().forEach((track) => track.stop());
    return { stop: () => undefined };
  }

  video.srcObject = stream;
  // `playsInline` matters on iOS, which otherwise takes the video fullscreen.
  video.playsInline = true;
  video.muted = true;
  await video.play().catch(() => undefined);

  const detector = new Detector({ formats: FORMATS });

  timer = setInterval(async () => {
    if (stopped || video.readyState < 2) return;
    try {
      const found = await detector.detect(video);
      const first = found[0];
      if (first?.rawValue) {
        stop();
        onDetected(first.rawValue);
      }
    } catch {
      // A single failed frame is normal — bad focus, motion blur. Keep going.
    }
  }, 400) as unknown as number;

  return { stop };
}
