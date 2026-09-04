import type { ReactNode } from "react";

/**
 * The three states every data-backed screen needs. Defined once here so the
 * app never grows a dozen bespoke "no results" treatments.
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Decorative glyph. Announced to nobody — the title carries the meaning. */
  icon?: string;
}

export function EmptyState({ title, description, action, icon = "🥤" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span aria-hidden="true" className="mb-4 text-5xl">
        {icon}
      </span>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
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
      className="flex flex-col items-center justify-center px-6 py-16"
    >
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-hairline border-t-cherry"
      />
      <span className="mt-4 text-sm text-ink-muted">{label}…</span>
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
    <div
      role="alert"
      className="mx-4 my-6 rounded-card border border-cherry/20 bg-cherry/5 px-5 py-6 text-center"
    >
      {/* The warning is carried by the heading text, not by colour alone. */}
      <h2 className="text-base font-semibold text-cherry-dark">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-pill bg-cherry px-5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      )}
    </div>
  );
}
