-- Rescale ratings from half points to tenths.
--
-- Scores were stored as INTEGER 0–20 representing 0.0–10.0 in steps of 0.5.
-- They are now INTEGER 0–100 representing 0.0–10.0 in steps of 0.1, so a
-- drink can be rated 8.2 rather than only 8.0 or 8.5.
--
-- Storage stays integer. The reason for that has not changed: an exact CHECK
-- constraint, and no floating-point values in the database to compare.
--
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt.
-- Existing scores are multiplied by 5, which is exact — every old half point
-- lands on a whole tenth (15 → 75 is still 7.5).

CREATE TABLE ratings_new (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  drink_id   TEXT NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  UNIQUE (user_id, drink_id),
  CHECK (score BETWEEN 0 AND 100)
);

INSERT INTO ratings_new (id, user_id, drink_id, score, created_at, updated_at)
SELECT id, user_id, drink_id, score * 5, created_at, updated_at
FROM ratings;

DROP TABLE ratings;

ALTER TABLE ratings_new RENAME TO ratings;

-- Indexes do not survive the rebuild, so recreate them.
CREATE INDEX idx_ratings_drink ON ratings (drink_id);
CREATE INDEX idx_ratings_user  ON ratings (user_id);
