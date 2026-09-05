-- Drank — development-only seed data.
--
-- Layers fake users, ratings and collection entries on top of the catalogue in
-- seed/catalogue.sql. Run that first.
--
-- NEVER run this against production: the ratings are fabricated and would show
-- up as real community scores, and the accounts cannot be logged into.

-- Re-runnable: every row this file owns is prefixed `seed-` and cleared first.
--
-- Drinks are never deleted here — they belong to catalogue.sql, and deleting
-- one would cascade through ratings.drink_id and collection_entries.drink_id
-- and destroy real users' data.
DELETE FROM ratings            WHERE id LIKE 'seed-%';
DELETE FROM collection_entries WHERE id LIKE 'seed-%';
DELETE FROM users              WHERE id LIKE 'seed-%';

-- ---------------------------------------------------------------------------
-- Users. `password_hash` is a placeholder that cannot match real PBKDF2
-- verification, so these accounts can never be logged into.
-- ---------------------------------------------------------------------------
INSERT INTO users (id, username, email, password_hash, display_name) VALUES
  ('seed-user-demo', 'demo',  'demo@example.com',  'seed-no-login', 'Demo Collector'),
  ('seed-user-ally', 'ally',  'ally@example.com',  'seed-no-login', 'Ally'),
  ('seed-user-bo',   'bo',    'bo@example.com',    'seed-no-login', 'Bo'),
  ('seed-user-cass', 'cass',  'cass@example.com',  'seed-no-login', 'Cass'),
  ('seed-user-dev',  'devan', 'devan@example.com', 'seed-no-login', 'Devan');

-- The catalogue leaves every drink unattributed, because in production nobody
-- contributed them. In development, crediting the two deliberately incomplete
-- rows to a user exercises the "added by" path.
UPDATE drinks SET created_by_user_id = 'seed-user-demo' WHERE id = 'seed-incomplete-1';
UPDATE drinks SET created_by_user_id = 'seed-user-ally' WHERE id = 'seed-incomplete-2';

-- Spread the catalogue over the past six months. Inserted in one statement,
-- every drink would otherwise share a created_at to the millisecond, which
-- makes "recently added" arbitrary and untestable. Derived from rowid so the
-- ordering is identical on every machine.
UPDATE drinks
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ((rowid * 7) % 180) || ' days'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ((rowid * 7) % 180) || ' days')
WHERE id LIKE 'seed-%';

-- ---------------------------------------------------------------------------
-- Ratings — each seed user rates roughly 60% of the catalogue, scored
-- 4.5..9.5 (stored as tenths 45..95). Gives the community-rating query
-- something realistic to average, at the full 0.1 resolution.
--
-- The selection and the score are derived from a hash of the user and drink
-- ids rather than random(), for two reasons:
--   1. Determinism. Every machine gets the same catalogue, so screenshots and
--      any test that leans on seed data stay stable.
--   2. random() references no column, so SQLite hoists it out of the join's
--      inner loop and evaluates it once per user — giving each user all 54
--      drinks or none at all. Referencing d.id keeps it per-row.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO ratings (id, user_id, drink_id, score)
SELECT 'seed-r-' || u.id || '-' || d.id,
       u.id,
       d.id,
       45 + ((unicode(substr(d.id, -1)) * 19
              + unicode(substr(d.id, -3, 1)) * 31
              + unicode(substr(u.id, -2, 1)) * 11) % 51)
FROM users u
CROSS JOIN drinks d
WHERE u.id LIKE 'seed-user-%'
  AND d.id LIKE 'seed-%'
  AND ((unicode(substr(d.id, -1)) * 7
        + unicode(substr(d.id, -2, 1)) * 13
        + unicode(substr(u.id, -1)) * 53
        + unicode(substr(u.id, -2, 1)) * 3
        + length(u.id) * 37) % 100) < 60;

-- ---------------------------------------------------------------------------
-- A starter collection for the demo user: everything they rated 7.5 or above
-- (75 tenths).
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO collection_entries (id, user_id, drink_id, is_favourite, notes)
SELECT 'seed-c-' || r.drink_id,
       r.user_id,
       r.drink_id,
       CASE WHEN r.score >= 90 THEN 1 ELSE 0 END,
       CASE WHEN r.score >= 95 THEN 'One of the best I have tried.' ELSE NULL END
FROM ratings r
WHERE r.user_id = 'seed-user-demo'
  AND r.score >= 75;

