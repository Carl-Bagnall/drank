import { usePageTitle } from "../usePageTitle";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { ApiRequestError } from "../api";
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
  usePageTitle("Sign in");
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  // Sign-in accepts either; sign-up needs a real email address.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** Which input the error belongs to, when the server names one. */
  const [errorField, setErrorField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Moving focus in an effect rather than from the submit handler: the
  // handler runs before React has committed the state that marks the field,
  // so focusing there raced the render.
  useEffect(() => {
    if (!errorField) return;
    document.getElementById(errorField)?.focus();
  }, [errorField]);

  if (loading) return <LoadingState label="Checking your session" />;

  // Already signed in: go where they were headed, or to their collection.
  if (user) {
    const to = (location.state as { from?: string } | null)?.from ?? "/collection";
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setErrorField(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(username, email, password);
      } else {
        await signIn(identifier, password);
      }
      const to = (location.state as { from?: string } | null)?.from ?? "/collection";
      navigate(to, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );

      // WCAG asks that an error identifies the control it relates to. When the
      // server names the field, mark it and move focus there so the fix is one
      // action away rather than a hunt.
      const field =
        err instanceof ApiRequestError && typeof err.details["field"] === "string"
          ? (err.details["field"] as string)
          : null;
      setErrorField(field);
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
              setErrorField(null);
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
        {isSignUp ? (
          <>
            <Field
              id="username"
              label="Username"
              invalid={errorField === "username"}
              value={username}
              onChange={setUsername}
              autoComplete="username"
              hint="Letters, numbers and underscores. 2–32 characters."
              required
            />
            <Field
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              invalid={errorField === "email"}
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
          </>
        ) : (
          /* Deliberately type="text", not type="email": the browser's own
             email validation would reject a bare username. `autocomplete
             ="username"` is the correct token for a login identifier field
             even when it holds an email address. */
          <Field
            id="identifier"
            label="Email or username"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="username"
            required
          />
        )}

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
            id="form-error"
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
  invalid = false,
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
  /** Marks the input as the one the server rejected. */
  invalid?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  // Points at the error text as well as the hint, so a screen reader reads the
  // reason when focus lands here.
  const describedBy = [hintId, invalid ? "form-error" : null]
    .filter(Boolean)
    .join(" ");

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
        aria-describedby={describedBy || undefined}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "sticker-sm min-h-11 w-full bg-surface px-3 text-base font-medium text-ink",
          // A red ring as well as the message: never colour alone, but colour
          // does help locate the field being described.
          invalid ? "ring-[3px] ring-cherry" : "",
        ].join(" ")}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
