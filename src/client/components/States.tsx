import type { ReactNode } from "react";

/**
 * The three states every data-backed screen needs, defined once so the app
 * never grows a dozen bespoke "no results" treatments.
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Decorative glyph. The title carries the meaning. */
  icon?: string;
  /** Sticker fill behind the glyph. */
  tone?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "🥤",
  tone = "bg-citrus",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span
        aria-hidden="true"
        className={`mb-5 flex size-20 rotate-[-4deg] items-center justify-center rounded-[18px] border-[3px] border-ink text-4xl shadow-[var(--shadow-sticker-lg)] ${tone}`}
      >
        {icon}
      </span>
      <h2 className="text-xl text-ink">{title}</h2>
      {description && (
        <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center px-6 py-14"
    >
      <span
        aria-hidden="true"
        className="size-9 animate-spin rounded-full border-[3px] border-ink border-t-cherry"
      />
      <span className="mt-4 text-sm font-medium text-ink-muted">{label}…</span>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="sticker mt-3 overflow-hidden">
      {/* A solid cherry header bar, so the alert is identifiable by structure
          and wording rather than by colour alone. */}
      <div className="flex items-center gap-2 border-b-[2.5px] border-ink bg-cherry px-4 py-2.5">
        <span aria-hidden="true" className="text-base">
          ⚠️
        </span>
        <h2 className="text-sm text-ink">{title}</h2>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm leading-relaxed text-ink-muted">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn btn-citrus mt-4">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
