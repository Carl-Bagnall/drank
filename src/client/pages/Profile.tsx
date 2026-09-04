import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { CollectionItem } from "../../shared/types";
import * as api from "../api";
import { useAuth } from "../auth";
import { CollectionStats } from "../components/CollectionStats";
import { DrinkGrid } from "../components/DrinkGrid";
import { EmptyState, LoadingState } from "../components/States";

/**
 * Profile.
 *
 * Deliberately not a social page. The brief asks for the shape to allow
 * public profiles and following later, which the data model supports — but
 * building any of it now would be inventing requirements.
 */
export function Profile() {
  const { user, stats, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [favourites, setFavourites] = useState<CollectionItem[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api
      .getFavourites(controller.signal)
      .then((response) => setFavourites(response.items))
      .catch(() => {
        // Favourites are a bonus panel; the rest of the page still works.
      });
    return () => controller.abort();
  }, [user]);

  if (loading) return <LoadingState label="Checking your session" />;

  if (!user) {
    return (
      <EmptyState
        icon="👤"
        tone="bg-berry"
        title="Sign in to see your profile"
        description="Your profile shows what you have collected — the brands, the countries and how you rate them."
        action={
          <Link to="/signin" state={{ from: "/profile" }} className="btn btn-cherry">
            Sign in
          </Link>
        }
      />
    );
  }

  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <section className="sticker-lg bg-berry px-5 py-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-16 items-center justify-center rounded-full border-[3px] border-ink bg-surface font-display text-2xl text-ink shadow-[var(--shadow-sticker)]"
        >
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <h1 className="mt-3 text-2xl text-ink">{user.displayName ?? user.username}</h1>
        <p className="mt-1 text-sm font-medium text-ink">@{user.username}</p>
        <p className="mt-2 text-xs font-medium text-ink">Collecting since {joined}</p>
      </section>

      {stats && (
        <div className="mt-5">
          <h2 className="eyebrow mb-2 px-1">Collection</h2>
          <CollectionStats stats={stats} />
        </div>
      )}

      {favourites.length > 0 && (
        <section className="mt-7" aria-labelledby="favourites-heading">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 id="favourites-heading" className="eyebrow">
              Favourites
            </h2>
            <Link
              to="/collection?favourites=true"
              className="text-xs font-semibold text-ink underline underline-offset-2"
            >
              See all
            </Link>
          </div>
          <DrinkGrid drinks={favourites.slice(0, 6)} label="Favourite drinks" />
        </section>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            await signOut();
            navigate("/");
          }}
          className="btn w-full disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
