-- Wantlist, and the rule that a rating implies a collected drink.
--
-- A collection entry gains a status: 'collected' (tried it, it is yours) or
-- 'wanted' (want to try it). One table rather than two, because the existing
-- UNIQUE(user_id, drink_id) then makes the two states mutually exclusive by
-- construction — a drink cannot be both owned and wanted — and moving a drink
-- from the wantlist to the collection is an UPDATE rather than a delete and
-- an insert, so notes and favourite status survive the move.
--
-- `added_at` is deliberately reset when a wanted drink becomes collected: it
-- means "when this joined your collection", which is what the Collection
-- page's "recently added" sort needs to be useful.
--
-- SQLite cannot add a CHECK constraint in place, so the table is rebuilt.
-- Nothing references collection_entries, so the drop is safe.

CREATE TABLE collection_entries_new (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  drink_id     TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'collected',
  added_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notes        TEXT,
  is_favourite INTEGER NOT NULL DEFAULT 0,

  UNIQUE (user_id, drink_id),
  CHECK (status IN ('collected', 'wanted')),
  CHECK (is_favourite IN (0, 1))
);

-- Everything that existed was a collected drink; the wantlist is new.
INSERT INTO collection_entries_new
  (id, user_id, drink_id, status, added_at, notes, is_favourite)
SELECT id, user_id, drink_id, 'collected', added_at, notes, is_favourite
FROM collection_entries;

DROP TABLE collection_entries;

ALTER TABLE collection_entries_new RENAME TO collection_entries;

CREATE INDEX idx_collection_user_added  ON collection_entries (user_id, added_at DESC);
CREATE INDEX idx_collection_drink       ON collection_entries (drink_id);
CREATE INDEX idx_collection_user_status ON collection_entries (user_id, status);

-- Enforce the new invariant on data that predates it: rating a drink now
-- means owning it, so every existing rating gets a collected entry if it does
-- not already have one. Without this, old ratings would sit against drinks
-- that are in nobody's collection, which the app can no longer represent.
INSERT INTO collection_entries (id, user_id, drink_id, status)
SELECT lower(hex(randomblob(16))), r.user_id, r.drink_id, 'collected'
FROM ratings r
WHERE NOT EXISTS (
  SELECT 1 FROM collection_entries ce
  WHERE ce.user_id = r.user_id AND ce.drink_id = r.drink_id
);
