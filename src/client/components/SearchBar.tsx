import { useEffect, useRef, useState } from "react";

/**
 * Search input.
 *
 * Uncontrolled from the caller's perspective: it holds the typed text and
 * reports a debounced value, so every keystroke does not become a request.
 * Mobile keyboard hints matter here — the app is meant to be used in a shop.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search drinks, brands, flavours…",
  delayMs = 250,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delayMs?: number;
}) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep in step when the caller resets the query (e.g. "clear filters").
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, value, onChange, delayMs]);

  return (
    <div className="sticker flex items-center gap-2 px-3 py-2">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="size-5 shrink-0 text-ink"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.4" />
        <path
          d="m16.5 16.5 4 4"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>

      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search the drink catalogue"
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        className="min-h-9 w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-faint"
      />

      {text && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText("");
            onChange("");
            inputRef.current?.focus();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sunken text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-3.5">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
