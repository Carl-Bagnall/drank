import { useState } from "react";

/**
 * Product imagery, with a designed fallback.
 *
 * No drink in the catalogue has a photograph yet — user uploads and R2 come
 * later — so the placeholder is not an edge case here, it is the default
 * appearance. It draws a can in the drink's category colour with label
 * stripes derived from the id, so a grid reads as varied rather than as rows
 * of identical broken images.
 *
 * The same fallback covers a real image that fails to load.
 */

/** Category colours. These are the palette accents, reused as coding. */
const CATEGORY_TONE: Record<string, string> = {
  cola: "bg-tang",
  fruit: "bg-cherry",
  lemonade: "bg-lime",
  citrus: "bg-citrus",
  energy: "bg-berry",
  ginger_beer: "bg-fizz",
};

const FALLBACK_TONES = [
  "bg-cherry",
  "bg-citrus",
  "bg-lime",
  "bg-berry",
  "bg-fizz",
  "bg-tang",
];

/** Small deterministic string hash, so a drink always looks the same. */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function toneForDrink(id: string, category: string | null): string {
  if (category && CATEGORY_TONE[category]) return CATEGORY_TONE[category];
  return FALLBACK_TONES[hash(id) % FALLBACK_TONES.length]!;
}

interface DrinkImageProps {
  drinkId: string;
  name: string;
  brand: string;
  category?: string | null;
  imageUrl: string | null;
  /** `lg` is the detail page hero. */
  size?: "sm" | "lg";
}

export function DrinkImage({
  drinkId,
  name,
  brand,
  category = null,
  imageUrl,
  size = "sm",
}: DrinkImageProps) {
  const [failed, setFailed] = useState(false);
  const tone = toneForDrink(drinkId, category);
  const showPlaceholder = !imageUrl || failed;

  return (
    <div
      className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden ${tone}`}
    >
      {showPlaceholder ? (
        <CanGlyph seed={hash(drinkId)} large={size === "lg"} />
      ) : (
        <img
          src={imageUrl}
          alt={`${brand} ${name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain p-2"
        />
      )}
    </div>
  );
}

/**
 * A can drawn in ink, with two label stripes whose widths come from the seed
 * so each drink has a recognisable fingerprint. Decorative: the card and the
 * detail page carry the name in text.
 */
function CanGlyph({ seed, large }: { seed: number; large: boolean }) {
  const topStripe = 30 + (seed % 25);
  const bottomStripe = 20 + ((seed >> 3) % 30);

  return (
    <svg
      viewBox="0 0 64 88"
      aria-hidden="true"
      className={large ? "h-3/5" : "h-2/3"}
      fill="none"
    >
      {/* Body */}
      <rect
        x="12"
        y="6"
        width="40"
        height="76"
        rx="9"
        fill="rgb(255 255 255 / 0.55)"
        stroke="#141210"
        strokeWidth="4"
      />
      {/* Lid */}
      <path
        d="M14 17h36"
        stroke="#141210"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Label stripes */}
      <rect
        x={32 - topStripe / 2}
        y="34"
        width={topStripe}
        height="8"
        rx="4"
        fill="#141210"
      />
      <rect
        x={32 - bottomStripe / 2}
        y="48"
        width={bottomStripe}
        height="6"
        rx="3"
        fill="#141210"
      />
    </svg>
  );
}
