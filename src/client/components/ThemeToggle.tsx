import { useTheme, type ThemePreference } from "../theme";

const OPTIONS: { value: ThemePreference; label: string; glyph: string }[] = [
  { value: "light", label: "Light", glyph: "☀" },
  { value: "dark", label: "Dark", glyph: "☾" },
  { value: "system", label: "System", glyph: "◐" },
];

/**
 * Appearance setting: light, dark, or follow the device.
 *
 * Native radios rather than buttons with `aria-pressed`. The three options are
 * one mutually exclusive choice, which is what a radio group is, and it brings
 * arrow-key navigation, roving focus and the right screen-reader announcement
 * for free — all of which a group of buttons would have to reimplement. The
 * inputs are visually hidden and the labels carry the sticker styling; the
 * focus ring is driven off `peer-focus-visible` so it still follows the input.
 */
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <fieldset>
      <legend className="eyebrow px-1">Appearance</legend>

      <div className="sticker-sm mt-2 flex gap-1 bg-surface p-1">
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <label key={option.value} className="flex-1">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={selected}
                onChange={() => setPreference(option.value)}
                className="peer sr-only"
              />
              <span
                className={[
                  "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] text-sm",
                  "peer-focus-visible:outline peer-focus-visible:outline-[3px]",
                  "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cherry",
                  selected
                    ? "border-2 border-ink bg-citrus font-display text-ink shadow-[var(--shadow-sticker-sm)]"
                    : "border-2 border-transparent font-semibold text-ink-muted",
                ].join(" ")}
              >
                <span aria-hidden="true">{option.glyph}</span>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-2 px-1 text-xs font-medium text-ink-muted">
        {preference === "system"
          ? `Following your device — currently ${resolved}.`
          : `Always ${preference}, on this device.`}
      </p>
    </fieldset>
  );
}
