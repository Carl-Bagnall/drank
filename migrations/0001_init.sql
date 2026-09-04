-- Drank — initial schema
--
-- Design notes:
--  * Only `drinks.name` and `drinks.brand` are NOT NULL. Everything else is
--    optional, because a user-contributed drink may start life as little more
--    than a name, a brand and a photo.
--  * Ratings are stored as INTEGER half-points (0..20) representing 0.0..10.0.
--    Integers keep the CHECK constraint trivial and avoid float comparison
--    bugs; divide by 2.0 for display.
--  * There is no stored community-rating aggregate. It is AVG()'d at query
--    time against idx_ratings_drink.
--  * A collection entry does NOT carry a rating. `ratings` is the single
--    source of truth, so a user can rate a drink they do not own.
--  * Timestamps are ISO-8601 UTC TEXT: readable in a raw row dump and
--    directly parseable by `new Date(...)`.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Created now (ahead of auth in Phase 3) because drinks.created_by_user_id
-- must have something to reference. The sessions table arrives with auth.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (length(username) BETWEEN 2 AND 32),
  CHECK (email LIKE '%_@_%')
);

-- ---------------------------------------------------------------------------
-- drinks — the global catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE drinks (
  id                  TEXT PRIMARY KEY,

  -- The only required fields.
  name                TEXT NOT NULL,
  brand               TEXT NOT NULL,
  -- Lowercased/trimmed brand, maintained by the API. Groups variant families
  -- ("all Coca-Cola drinks") and backs duplicate detection without a join.
  brand_normalised    TEXT NOT NULL,

  flavour             TEXT,
  category            TEXT,
  country             TEXT,          -- ISO 3166-1 alpha-2, e.g. 'GB'
  region              TEXT,
  volume_ml           INTEGER,
  packaging           TEXT,
  barcode             TEXT,
  description         TEXT,
  image_url           TEXT,
  caffeine_status     TEXT,
  sugar_status        TEXT,

  -- Moderation/visibility only. Product lifecycle (limited edition, seasonal,
  -- discontinued) is a separate concern and gets its own column later.
  status              TEXT NOT NULL DEFAULT 'published',
  merged_into_drink_id TEXT REFERENCES drinks(id) ON DELETE SET NULL,

  external_source     TEXT,          -- e.g. 'open_food_facts'
  external_source_id  TEXT,

  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(brand)) > 0),
  CHECK (status IN ('published', 'hidden', 'merged')),
  CHECK (volume_ml IS NULL OR volume_ml > 0),
  CHECK (country IS NULL OR length(country) = 2),
  CHECK (packaging IS NULL OR packaging IN
         ('can', 'bottle_glass', 'bottle_plastic', 'carton', 'pouch', 'other')),
  CHECK (caffeine_status IS NULL OR caffeine_status IN
         ('caffeinated', 'caffeine_free', 'unknown')),
  CHECK (sugar_status IS NULL OR sugar_status IN
         ('full_sugar', 'reduced_sugar', 'zero_sugar', 'unknown'))
);

CREATE INDEX idx_drinks_brand        ON drinks (brand_normalised);
CREATE INDEX idx_drinks_category     ON drinks (category);
CREATE INDEX idx_drinks_country      ON drinks (country);
CREATE INDEX idx_drinks_created_at   ON drinks (created_at DESC);
CREATE INDEX idx_drinks_name_lookup  ON drinks (brand_normalised, name COLLATE NOCASE);

-- Barcodes are optional, but must be unique when present.
CREATE UNIQUE INDEX idx_drinks_barcode ON drinks (barcode)
  WHERE barcode IS NOT NULL;

-- The same external product must not be imported twice.
CREATE UNIQUE INDEX idx_drinks_external ON drinks (external_source, external_source_id)
  WHERE external_source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- collection_entries — a user's personal collection
-- ---------------------------------------------------------------------------
CREATE TABLE collection_entries (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  drink_id     TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  added_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes        TEXT,
  is_favourite INTEGER NOT NULL DEFAULT 0,

  -- The database-level guarantee behind "cannot add the same drink twice".
  UNIQUE (user_id, drink_id),
  CHECK (is_favourite IN (0, 1))
);

CREATE INDEX idx_collection_user_added ON collection_entries (user_id, added_at DESC);
CREATE INDEX idx_collection_drink      ON collection_entries (drink_id);

-- ---------------------------------------------------------------------------
-- ratings — 0..10 in half-point steps, stored as 0..20
-- ---------------------------------------------------------------------------
CREATE TABLE ratings (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  drink_id   TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  UNIQUE (user_id, drink_id),
  CHECK (score BETWEEN 0 AND 20)
);

CREATE INDEX idx_ratings_drink ON ratings (drink_id);
CREATE INDEX idx_ratings_user  ON ratings (user_id);
