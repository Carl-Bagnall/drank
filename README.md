# Drank

A community-driven catalogue and collection app for soft drinks — "Discogs for soft drinks".

Mobile-first React SPA and a Hono API, served from a single Cloudflare Worker, backed by D1.

> **Status: Phase 2 (catalogue).** Browse, search, filter and view drinks, with community ratings. Accounts, collections and rating submission are not built yet — see [Roadmap](#roadmap).

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

54 drinks across 27 brands and 11 countries, 5 users and ~160 ratings. The seed is re-runnable — it deletes and recreates everything prefixed `seed-`. **Do not run it against production.**

## 6. Configure environment variables

Phase 1 has no secrets. When they arrive, copy `.dev.vars.example` to `.dev.vars` (git-ignored) for local use, and set production values with `npx wrangler secret put NAME`. Never commit secrets, and never expose them to the browser — external API calls that need credentials happen in the Worker.

## 7. Run locally

```bash
npm run dev
```

Open <http://localhost:5173>. The Cloudflare Vite plugin runs the Worker in workerd alongside Vite, so the local app uses real bindings and a real D1 database rather than mocks.

The home screen shows two shelves of drinks. If they load, the full stack — React → API → Hono → D1 — is working. `GET /api/health` reports the same thing as JSON, and is the quicker check when something looks wrong.

## 8. Deploy

```bash
npm run deploy
```

This builds and deploys using the generated `dist/drank/wrangler.json`. Deployment automation is Phase 7 and is not set up yet; `.github/workflows/ci.yml` currently runs typecheck, tests and build only.

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
| `GET /api/drinks/:id` | One drink, its community rating and its brand siblings |

**There is no separate `/api/search`.** The brief suggests one, but searching differs from listing only by a `WHERE` clause — a second route would duplicate the sorting, pagination and rating-aggregation logic for no benefit. Search is `GET /api/drinks?q=…`.

`cursor` is opaque and must be passed back verbatim. It currently encodes an offset; moving to keyset pagination later changes only that encoding, not the API shape.

SQL lives in `src/worker/db/`, not in route handlers, so routes stay about HTTP and queries can be tested directly.

### Database

Four tables: `users`, `drinks`, `collection_entries`, `ratings`.

- **Only `name` and `brand` are required on a drink.** The catalogue must accept incomplete, user-contributed products.
- **Ratings are stored as integer half-points, 0–20**, representing 0.0–10.0. Integers make the range check trivial and avoid floating-point comparison bugs. All conversion lives in `src/shared/rating.ts`.
- **The community rating is not stored.** It is averaged at query time against an index on `ratings(drink_id)`.
- **A collection entry carries no rating.** `ratings` is the single source of truth, which keeps "owning" and "rating" separate — you can rate a drink you do not own.
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
| 3 | Accounts and collections | Next |
| 4 | Ratings UI: personal and community | |
| 5 | Open Food Facts lookup and barcode scanning | |
| 6 | Polish: mobile UX, accessibility, performance | |
| 7 | Production deployment and GitHub workflows | |
