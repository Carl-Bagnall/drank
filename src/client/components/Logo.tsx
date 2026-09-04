interface LogoProps {
  /** `lg` is the hero treatment on Home; `sm` sits in the header. */
  size?: "sm" | "lg";
}

/**
 * The Drank wordmark, built as a sticker: a flat cherry block, a heavy ink
 * outline and a hard offset shadow, with bubbles fizzing up off the "k".
 *
 * The bubbles ascend diagonally and shrink as they rise. Stacked vertically
 * they read as a colon, which makes the wordmark look like "drank:".
 *
 * Ink on cherry is ~5.4:1, so the wordmark clears AA. White on cherry would
 * only reach ~3.5:1, which is why text is never light on an accent.
 */
export function Logo({ size = "sm" }: LogoProps) {
  const isLarge = size === "lg";

  return (
    <span
      className={[
        "inline-flex items-end gap-1.5 border-ink bg-cherry",
        isLarge
          ? "rounded-[16px] border-[3px] px-5 pb-2.5 pt-3 shadow-[var(--shadow-sticker-lg)]"
          : "rounded-[11px] border-[2.5px] px-3 pb-1.5 pt-2 shadow-[var(--shadow-sticker-sm)]",
      ].join(" ")}
    >
      <span
        className={[
          "font-display lowercase leading-none tracking-[-0.04em] text-ink",
          isLarge ? "text-[2.75rem]" : "text-lg",
        ].join(" ")}
      >
        drank
      </span>

      {/* Fizz. Decorative, so hidden from assistive tech. */}
      <svg
        viewBox="0 0 16 26"
        aria-hidden="true"
        className={isLarge ? "mb-1 h-11 w-6" : "mb-0.5 h-[1.15rem] w-2.5"}
      >
        <circle cx="4.5" cy="21" r="3.4" fill="currentColor" className="text-ink" />
        <circle cx="9.5" cy="12" r="2.4" fill="currentColor" className="text-ink" />
        <circle cx="13" cy="4.5" r="1.6" fill="currentColor" className="text-ink" />
      </svg>
    </span>
  );
}
