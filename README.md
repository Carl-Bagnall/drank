# Drank

A community-driven catalogue and collection app for soft drinks — "Discogs for soft drinks".

Mobile-first React SPA and a Hono API, served from a single Cloudflare Worker, backed by D1.

> **Status: deployed.** Live at <https://drank.carlbagnall.workers.dev>. Accounts, catalogue, collections, wantlist, ratings, barcode lookup and drink contribution all work. Phase 6 polish — mobile UX, accessibility, performance — is what remains.

---

## Requirements

- **Node.js 24 LTS** or newer (`node --version`)
- A **Cloudflare account** (only needed to deploy or to use a remote database; local development needs no Cloudflare login)

---

## 1. Install dependencies

```bash
npm install
```

npm 11 blocks package install scripts by default. The warning about `workerd` and `esbuild` is expected and safe to ignore — both ship their platform binaries as optional dependencies rather than postinstall downloads.

## 2. Generate Worker types

`worker-configuration.d.ts` is derived from `wrangler.jsonc` and is deliberately git-ignored, so generate it after cloning and again whenever you change bindings:

```bash
npm run cf-typegen
```

## 3. Create the D1 database

Local development uses a local SQLite database managed by Wrangler and needs no Cloudflare account. You only need this step to deploy or to work against remote data:

```bash
npx wrangler login
npx wrangler d1 create drank
```

Copy the `database_id` it prints into `d1_databases[0].database_id` in `wrangler.jsonc`.

> **Changing `database_id` resets your local database.** Wrangler keys the local SQLite file off that id, so pointing the binding at a different database gives you a brand-new empty one — the old data is still on disk under the previous id, but nothing reads it. Re-run steps 4 and 5 after any change to it. The symptom is `/api/health` returning `database: unavailable` and the home screen showing an error.

## 4. Run migrations

```bash
npm run db:migrate          # local
npm run db:migrate:remote   # against Cloudflare
```

## 5. Load seed data

```bash
npm run db:seed             # local
```

54 drinks across 27 brands and 11 countries, 5 users and ~160 ratings. The seed is re-runnable and safe on a database with real users in it: it replaces only rows it owns, and upserts drinks rather than deleting them, because deleting a drink would cascade away real ratings and collection entries. **Do not run it against production.**

## 6. Configure environment variables

Phase 1 has no secrets. When they arrive, copy `.dev.vars.example` to `.dev.vars` (git-ignored) for local use, and set production values with `npx wrangler secret put NAME`. Never commit secrets, and never expose them to the browser — external API calls that need credentials happen in the Worker.

## 7. Run locally

```bash
npm run dev
```

Open <http://localhost:5173>. The Cloudflare Vite plugin runs the Worker in workerd alongside Vite, so the local app uses real bindings and a real D1 database rather than mocks.

The home screen shows two shelves of drinks. If they load, the full stack — React → API → Hono → D1 — is working. `GET /api/health` reports the same thing as JSON, and is the quicker check when something looks wrong.

## 8. Deploy

**Production:** <https://drank.carlbagnall.workers.dev>
**Staging:** <https://staging-drank.carlbagnall.workers.dev>

Pushing to `main` deploys production. Pushing any other branch deploys staging. Both run typecheck, tests and build first, and both apply migrations before deploying — so a failing test or a broken migration stops the release rather than reaching users.

**The two have separate D1 databases** (`drank` and `drank-staging`), which is the point: a preview branch can run migrations and write rows without touching real accounts.

To deploy by hand:

```bash
npm run deploy
```

Staging by hand needs the environment resolved at build time:

```bash
CLOUDFLARE_ENV=staging npm run build && npx wrangler deploy -c dist/drank/wrangler.json
```

> **`wrangler deploy --env staging` does not work here**, and fails in a confusing way — it silently deploys production. The Cloudflare Vite plugin owns `assets.directory`, so the source config alone is not deployable; the environment has to be resolved during `vite build` via `CLOUDFLARE_ENV`, which writes the correct name and bindings into `dist/drank/wrangler.json`.

### GitHub secrets

The workflows need two repository secrets, under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token, using the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID in the right-hand sidebar |

Until both exist, every workflow run fails at the deploy step. The checks before it still run, so a red build tells you which.

---

## Other commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | Type-check all three TS projects |
| `npm run build` | Production build |
| `npm run db:studio` | List the tables in the local database |

---

## Project structure

```
migrations/       D1 schema migrations, applied in order
seed/             Development seed data
src/
  client/         React SPA — components, pages, styles, API client
  worker/         Hono API — routes and, later, service layers
  shared/         Types and logic used by both sides
test/             Vitest suites, run inside workerd against real D1
```

`src/shared` is the contract between the two halves. It must not import from `client` or `worker`, and must not use DOM or Workers globals.

---

## Architecture

**One Worker serves everything.** The built SPA is served as static assets and the API lives at `/api/*` on the same Worker. `assets.run_worker_first: ["/api/*"]` in `wrangler.jsonc` is load-bearing: without it, the single-page-application fallback would answer unknown API paths with `index.html` instead of a JSON 404.

**Tests run against real D1.** `@cloudflare/vitest-pool-workers` executes the suite inside workerd, applying `migrations/` to an isolated database first. Schema guarantees — the unique constraint that stops duplicate collection entries, the rating range check — are therefore tested for real rather than mocked.

### API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Liveness, including a real D1 query |
| `GET /api/drinks` | List, search and filter. Params: `q`, `brand`, `category`, `country`, `sort` (`recent`/`rating`/`name`), `limit`, `cursor` |
| `GET /api/drinks/facets` | Filter options with counts, derived from the catalogue |
| `GET /api/drinks/:id` | One drink, its community rating, brand siblings, and the viewer's own entry |
| `POST /api/auth/register` | Create an account and sign in |
| `POST /api/auth/login` | Sign in with `identifier` (email **or** username) and `password` |
| `POST /api/auth/logout` | Revoke the current session |
| `GET /api/users/me` | The signed-in user and their collection stats |
| `GET /api/users/me/collection` | Their collection: sorted, filtered, paginated, plus stats |
| `GET /api/users/me/collection/facets` | Filter options drawn from what they own |
| `GET /api/users/me/favourites` | Favourited drinks, for the profile page |
| `POST /api/users/me/collection` | Add a drink (`{ drinkId }`) |
| `PATCH /api/users/me/collection/:drinkId` | Update notes and favourite status |
| `DELETE /api/users/me/collection/:drinkId` | Remove a drink |
| `POST /api/drinks/:id/rating` | Set your score (`{ score }`, 0–10 in steps of 0.1). Upserts |
| `DELETE /api/drinks/:id/rating` | Withdraw your score |
| `GET /api/drinks/:id/ratings` | Community spread across eleven whole-number bands. Public |
| `POST /api/drinks` | Contribute a drink. Name and brand required, everything else optional |
| `GET /api/brands/:brand/drinks` | Existing drinks under a brand, to surface duplicates before adding |
| `GET /api/products/barcode/:barcode` | Barcode lookup: catalogue first, then Open Food Facts |

**There is no separate `/api/search`.** The brief suggests one, but searching differs from listing only by a `WHERE` clause — a second route would duplicate the sorting, pagination and rating-aggregation logic for no benefit. Search is `GET /api/drinks?q=…`.

`cursor` is opaque and must be passed back verbatim. It currently encodes an offset; moving to keyset pagination later changes only that encoding, not the API shape.

SQL lives in `src/worker/db/`, not in route handlers, so routes stay about HTTP and queries can be tested directly.

### External product data

Open Food Facts, read-only, behind a `ProductDataProvider` interface in `src/worker/services/`. Nothing is scraped — this calls their documented v2 endpoint, asks only for the fields it uses, and identifies itself with a `User-Agent` as they request (`PRODUCT_USER_AGENT` in `wrangler.jsonc`).

- **The catalogue is the source of truth.** A barcode is matched against Drank first, and a provider only ever *suggests* values for a drink somebody is about to create. Nothing external writes to the database.
- **An unknown barcode is not an error**, and neither is the provider being down. Both return `not_found`, distinguished only by `providerAvailable`, because the user's next step is identical: type it in.
- **Successful lookups are cached for a day** using the Cloudflare Cache API rather than a KV namespace or a third-party store. Failures are never cached, so an outage cannot be remembered as a missing product.

### Barcode scanning

Uses the browser's own `BarcodeDetector`. A WASM decoder would work in more browsers but costs hundreds of kilobytes on an app meant to be fast on a phone in a shop.

**This means scanning does not work everywhere**, and the app says so rather than failing silently:

- **Works:** Chrome and Edge on Android, and desktop Chrome.
- **Does not work:** Firefox, and Safari or any iOS browser — every iOS browser uses WebKit, so an iPhone cannot scan regardless of which browser is installed.
- **Does not work over plain HTTP.** Camera access needs a secure context, so a dev server reached at a LAN address cannot scan even in Chrome. `localhost` counts as secure; production over HTTPS is fine.

Typing the barcode is therefore a first-class path, always visible, never hidden behind a failure. Everything after the lookup is identical whichever way the number arrived.

### Authentication

Email and password, with server-side sessions. No social login — the brief asks not to add it without a compelling reason, and it would mean a third-party dependency for something Cloudflare and D1 already cover.

- **Passwords are hashed with PBKDF2-HMAC-SHA-256** via WebCrypto. bcrypt, scrypt and Argon2 are stronger, but none run in workerd without shipping WASM; PBKDF2 is the strongest primitive the runtime offers natively. The algorithm, iteration count and salt are stored *with* each hash, so the cost can be raised later without invalidating existing passwords.
- **The iteration count is 210,000, below the OWASP-recommended 600,000.** 600k exceeds the 10ms CPU budget of a free-tier Worker request. Raise it when the app moves to a paid plan; old hashes keep verifying with their own recorded count.
- **Sessions are rows in D1, not stateless tokens**, so logout revokes access immediately rather than waiting for an expiry.
- **The database stores only a SHA-256 hash of the session token.** The token itself exists solely in the user's cookie, so a database dump cannot be replayed as live sessions.
- **The cookie is `httpOnly`, `SameSite=Lax` and `Secure`** (except on localhost, where browsers reject `Secure` cookies over plain HTTP). `SameSite=Lax` is what stops a cross-site form submission acting as the user.
- **Sign in accepts either an email address or a username.** Usernames are restricted to letters, digits and underscores, so they can never contain `@` — the two identifier spaces are disjoint by construction and one value can safely be checked against both columns. Both are `COLLATE NOCASE`, so matching is case-insensitive.
- **Login gives the same answer for a wrong password, an unknown email and an unknown username**, and verifies against a dummy hash when no user matches, so the form cannot be used to discover which addresses or usernames have accounts. The message names neither field.
- **Usernames are therefore login credentials.** That is a deliberate trade-off, and the same one GitHub and Reddit make; worth revisiting if public profiles ever expose usernames.

#### Known gaps

Recorded deliberately rather than left to be rediscovered.

**1. Rate limiting is a brake, not a hard cap.** *(Implemented in Phase 7.)* Auth endpoints go through Cloudflare's rate-limiting binding at 20 requests per minute, keyed on `CF-Connecting-IP` — a header the edge sets and a caller cannot forge.

Two honest caveats, both verified against the deployed Worker:

- **Cloudflare counts per isolate, not globally.** Hammering one keep-alive connection is refused at attempt 22. Rotating connections spreads the count across isolates and gets more headroom. It stops sustained abuse from one client; it is not an exact global ceiling.
- **Requests without `CF-Connecting-IP` are not limited at all.** That covers local development and the test suite. There is deliberately no fallback key: lumping every unidentified caller into one bucket limits nobody individually and throttles everyone together — which is exactly how the test suite locked itself out when it was first written that way. In production a request cannot reach the Worker without passing the edge that sets the header.

The limiter also fails open if the binding errors. A rate limiter that is itself broken must not become the outage it exists to prevent.

Rate limiting, password length and (later) breached-password screening are what actually defend the login form. Identifier secrecy never did — see gap 2.

**2. Registration reveals whether an email address has an account.** `POST /api/auth/register` answers "An account already exists for that email", so anyone can test an address for membership. Login is careful about this; registration is not.

This is common — plenty of large sites behave identically — but it is a genuine privacy leak in a way the equivalent username message is not: people choose their username knowing it is public, and a username must be checkable for anyone to pick one at all. Nobody chooses to publish their email.

Fixing it properly means not answering at signup time: accept the registration, then email the address either a verification link or a "someone tried to sign up with your address" notice. That requires outbound email, which is a feature in its own right — Cloudflare Email Routing handles inbound only, so it would mean a third-party sender. **Deferred until there is a reason to send email anyway, at which point the fix is cheap.**

### Database

Five tables: `users`, `drinks`, `collection_entries`, `ratings`, `sessions`.

- **Only `name` and `brand` are required on a drink.** The catalogue must accept incomplete, user-contributed products.
- **Ratings are stored as integer tenths, 0–100**, representing 0.0–10.0 in steps of 0.1. Integers keep the range check exact and keep floating-point values out of the database. All conversion lives in `src/shared/rating.ts`.
- **The community rating is not stored.** It is averaged at query time against an index on `ratings(drink_id)`.
- **A collection entry carries no rating** — `ratings` is still its own table — but the two are now coupled by product rule: rating a drink collects it, and removing a drink withdraws its rating. Keeping the tables separate means that rule can be relaxed later without a migration.
- **A collection entry is either `collected` or `wanted`.** One row per user per drink, so the collection and the wantlist are mutually exclusive by construction, and moving between them is an update rather than a delete and an insert.
- **The wantlist never counts towards collection totals.** Every stat, facet and favourites query is scoped to `status = 'collected'`.
- **Barcodes are optional but unique when present**, via a partial unique index.
- Brand, category and country are indexed text rather than lookup tables. `brand_normalised` groups variant families without a join.

### Conventions

- IDs are `crypto.randomUUID()` text; timestamps are ISO-8601 UTC text. Both favour readability in a raw row dump over compactness.
- `drinks.status` is moderation visibility (`published` / `hidden` / `merged`). Product lifecycle — limited edition, seasonal, discontinued — is a separate concern and gets its own column when it is needed.
- Components never call `fetch` directly; they go through `src/client/api.ts`.

### Pinned versions

`compatibility_date` is pinned to **2026-08-22** because the workerd bundled with `@cloudflare/vitest-pool-workers` does not yet accept later dates. Raise it once that package updates, and run the tests to confirm.

---

## Design system

Tokens live in `src/client/styles/index.css` using Tailwind v4's CSS-first `@theme` configuration — there is no `tailwind.config.js`.

The style is **collectible sticker** — neo-brutalist. It is built from four moves, applied consistently:

1. A heavy ink outline (2–3px) on every raised surface
2. A hard offset shadow with **zero blur**, so elements read as stickers lifting off the page
3. Flat, saturated colour blocks — no gradients anywhere
4. Heavy display type with tight tracking

The repeated outline-plus-shadow treatment is defined once as `.sticker`, `.sticker-lg`, `.sticker-sm` and `.btn` in `@layer components`, rather than being retyped as utility strings on every element.

**The colour rule is: ink text on every accent fill, never white.** White on cherry is only ~3.5:1 and fails AA, whereas ink clears 5:1 on all six accents (cherry ~5.4, berry ~7.4, fizz ~8.9, citrus ~12.8, lime ~13.8, paper ~17.5). There are six accents rather than one brand colour because they double as flavour and category coding later.

Status and navigation are never signalled by colour alone: the active tab changes shape (a filled, outlined pill), the emphasised Scan action gets a ring, and the error state has a solid header bar and an explicit heading.

Fonts are **self-hosted via `@fontsource`** — Archivo Black for display, Space Grotesk for UI — so there is no external request, no render-blocking round trip and no third-party privacy consideration.

The theme is light-only for now; a dark theme is one additional block of token overrides and needs no component changes.

---

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: tooling, shell, routing, schema, seed, tests | **Done** |
| 2 | Catalogue: drink API, cards, detail page, search, discovery | **Done** |
| 3 | Accounts and collections | **Done** |
| 4 | Ratings UI: personal and community | **Done** |
| 5 | Open Food Facts lookup and barcode scanning | **Done** |
| 6 | Polish: mobile UX, accessibility, performance | Next |
| 7 | Production deployment and GitHub workflows | **Done** |
