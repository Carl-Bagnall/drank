interface LogoProps {
  /** Rendered as a heading on the home screen, inline elsewhere. */
  size?: "sm" | "lg";
}

/**
 * The Drank wordmark.
 *
 * Lowercase, heavy, tightly tracked, with the dot of the "i"-like bubble
 * replaced by a cherry-coloured fizz dot after the word. Deliberately built
 * from type rather than an image so it stays crisp at every size and works
 * as a header, an avatar and a favicon.
 *
 * This uses the system font stack on purpose: picking a real display face is
 * a Phase 6 branding decision, and loading a webfont now would cost a render
 * -blocking request for something we expect to change.
 */
export function Logo({ size = "sm" }: LogoProps) {
  const text = size === "lg" ? "text-4xl" : "text-xl";
  const dot = size === "lg" ? "size-2.5" : "size-1.5";

  return (
    <span className="inline-flex items-baseline gap-1">
      <span
        className={`${text} font-display font-extrabold tracking-tight text-ink lowercase`}
      >
        drank
      </span>
      <span
        aria-hidden="true"
        className={`${dot} shrink-0 rounded-full bg-cherry`}
      />
    </span>
  );
}
