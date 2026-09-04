import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Logo } from "../components/Logo";
import { LoadingState } from "../components/States";

type Mode = "signin" | "signup";

/**
 * Sign in and create account, in one screen.
 *
 * Two routes for what is nearly the same three fields would double the
 * markup for no benefit, and on a phone a toggle is fewer taps than
 * navigating between pages.
 */
export function SignIn() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingState label="Checking your session" />;

  // Already signed in: go where they were headed, or to their collection.
  if (user) {
    const to = (location.state as { from?: string } | null)?.from ?? "/collection";
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(username, email, password);
      } else {
        await signIn(email, password);
      }
      const to = (location.state as { from?: string } | null)?.from ?? "/collection";
      navigate(to, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div>
      <div className="mb-6 text-center">
        <Logo size="lg" />
      </div>

      {/* Mode toggle */}
      <div role="group" aria-label="Sign in or create an account" className="flex gap-2">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={[
              "sticker-sm min-h-11 flex-1 font-display text-sm",
              mode === value ? "bg-citrus" : "bg-surface",
            ].join(" ")}
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="sticker mt-4 px-4 py-5">
        {isSignUp && (
          <Field
            id="username"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            hint="Letters, numbers and underscores. 2–32 characters."
            required
          />
        )}

        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />

        <Field
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          // Tells a password manager to offer a new password rather than
          // autofilling the existing one.
          autoComplete={isSignUp ? "new-password" : "current-password"}
          hint={isSignUp ? "At least 8 characters." : undefined}
          required
        />

        {error && (
          <p
            role="alert"
            className="sticker-sm mt-4 bg-cherry px-3 py-2 text-sm font-semibold text-ink"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-cherry mt-5 w-full disabled:opacity-60"
        >
          {submitting
            ? "Please wait…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-4 px-1 text-center text-xs leading-relaxed text-ink-muted">
        Your collection is private to you.
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "email" | "text";
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="mb-4 last:mb-0">
      <label htmlFor={id} className="eyebrow mb-1.5 block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        aria-describedby={hintId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="sticker-sm min-h-11 w-full bg-surface px-3 text-base font-medium text-ink"
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
