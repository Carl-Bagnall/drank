-- Drank — development seed data
--
-- Re-runnable: every row it owns is prefixed `seed-` and cleared first.
-- Never run this against production.
--
-- Deliberately includes multiple variants per brand, because the core
-- collecting idea is that "Coca-Cola" is a brand and "Coca-Cola Cherry" is a
-- drink. Some rows intentionally have NULL image_url / flavour / barcode so
-- the incomplete-product path and image placeholders get exercised.

DELETE FROM ratings            WHERE id LIKE 'seed-%';
DELETE FROM collection_entries WHERE id LIKE 'seed-%';
DELETE FROM drinks             WHERE id LIKE 'seed-%';
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

-- ---------------------------------------------------------------------------
-- Drinks
-- ---------------------------------------------------------------------------
INSERT INTO drinks
  (id, name, brand, brand_normalised, flavour, category, country, volume_ml,
   packaging, barcode, caffeine_status, sugar_status, description, created_by_user_id)
VALUES
  -- Coca-Cola family
  ('seed-cc-original', 'Coca-Cola Original Taste', 'Coca-Cola', 'coca-cola', 'Cola', 'cola', 'GB', 330, 'can', '5000112637922', 'caffeinated', 'full_sugar', 'The original cola, first sold in 1886.', NULL),
  ('seed-cc-zero', 'Coca-Cola Zero Sugar', 'Coca-Cola', 'coca-cola', 'Cola', 'cola', 'GB', 330, 'can', '5449000131805', 'caffeinated', 'zero_sugar', 'Coca-Cola taste without the sugar.', NULL),
  ('seed-cc-diet', 'Diet Coke', 'Coca-Cola', 'coca-cola', 'Cola', 'cola', 'GB', 330, 'can', '5000112658545', 'caffeinated', 'zero_sugar', 'Lighter-bodied cola, launched 1982.', NULL),
  ('seed-cc-cherry', 'Coca-Cola Cherry', 'Coca-Cola', 'coca-cola', 'Cherry', 'cola', 'GB', 330, 'can', '5000112611861', 'caffeinated', 'full_sugar', 'Cola with a cherry note.', NULL),
  ('seed-cc-vanilla', 'Coca-Cola Vanilla', 'Coca-Cola', 'coca-cola', 'Vanilla', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'full_sugar', 'Cola with a soft vanilla finish.', NULL),
  ('seed-cc-cherry-zero', 'Coca-Cola Zero Sugar Cherry', 'Coca-Cola', 'coca-cola', 'Cherry', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-cc-lemon-zero', 'Coca-Cola Zero Sugar Lemon', 'Coca-Cola', 'coca-cola', 'Lemon', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),

  -- Pepsi family
  ('seed-pep-original', 'Pepsi', 'Pepsi', 'pepsi', 'Cola', 'cola', 'GB', 330, 'can', '5060335635013', 'caffeinated', 'full_sugar', 'Sweeter, citrus-forward cola.', NULL),
  ('seed-pep-max', 'Pepsi Max', 'Pepsi', 'pepsi', 'Cola', 'cola', 'GB', 330, 'can', '5449000000996', 'caffeinated', 'zero_sugar', 'Maximum taste, no sugar.', NULL),
  ('seed-pep-max-cherry', 'Pepsi Max Cherry', 'Pepsi', 'pepsi', 'Cherry', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-pep-max-mango', 'Pepsi Max Mango', 'Pepsi', 'pepsi', 'Mango', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-pep-diet', 'Diet Pepsi', 'Pepsi', 'pepsi', 'Cola', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),

  -- Fanta family
  ('seed-fanta-orange', 'Fanta Orange', 'Fanta', 'fanta', 'Orange', 'fruit', 'GB', 330, 'can', '5000112552027', 'caffeine_free', 'reduced_sugar', 'Orange soft drink with 3.7% orange juice.', NULL),
  ('seed-fanta-lemon', 'Fanta Lemon', 'Fanta', 'fanta', 'Lemon', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', NULL, NULL),
  ('seed-fanta-fruit-twist', 'Fanta Fruit Twist', 'Fanta', 'fanta', 'Mixed Fruit', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', NULL, NULL),
  ('seed-fanta-grape', 'Fanta Grape', 'Fanta', 'fanta', 'Grape', 'fruit', 'US', 355, 'can', NULL, 'caffeine_free', 'full_sugar', 'Widely sold in the US; a regional variant for UK collectors.', NULL),

  -- Sprite / 7UP
  ('seed-sprite', 'Sprite', 'Sprite', 'sprite', 'Lemon & Lime', 'lemonade', 'GB', 330, 'can', '5449000014535', 'caffeine_free', 'reduced_sugar', 'Clear lemon and lime.', NULL),
  ('seed-sprite-zero', 'Sprite Zero', 'Sprite', 'sprite', 'Lemon & Lime', 'lemonade', 'GB', 330, 'can', NULL, 'caffeine_free', 'zero_sugar', NULL, NULL),
  ('seed-7up', '7UP', '7UP', '7up', 'Lemon & Lime', 'lemonade', 'GB', 330, 'can', NULL, 'caffeine_free', 'full_sugar', NULL, NULL),
  ('seed-7up-free', '7UP Free', '7UP', '7up', 'Lemon & Lime', 'lemonade', 'GB', 330, 'can', NULL, 'caffeine_free', 'zero_sugar', NULL, NULL),

  -- Dr Pepper / Mountain Dew
  ('seed-drp', 'Dr Pepper', 'Dr Pepper', 'dr pepper', 'Cherry Spice', 'cola', 'GB', 330, 'can', '5000112547795', 'caffeinated', 'full_sugar', '23 flavours, famously hard to describe.', NULL),
  ('seed-drp-zero', 'Dr Pepper Zero', 'Dr Pepper', 'dr pepper', 'Cherry Spice', 'cola', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-md-original', 'Mountain Dew', 'Mountain Dew', 'mountain dew', 'Citrus', 'citrus', 'US', 355, 'can', NULL, 'caffeinated', 'full_sugar', 'Bright citrus, high caffeine.', NULL),
  ('seed-md-zero', 'Mountain Dew Zero Sugar', 'Mountain Dew', 'mountain dew', 'Citrus', 'citrus', 'US', 355, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),

  -- Irn-Bru
  ('seed-bru', 'Irn-Bru', 'Irn-Bru', 'irn-bru', NULL, 'other', 'GB', 330, 'can', '5000382000018', 'caffeinated', 'reduced_sugar', 'Scotland''s other national drink.', NULL),
  ('seed-bru-sf', 'Irn-Bru Sugar Free', 'Irn-Bru', 'irn-bru', NULL, 'other', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-bru-xtra', 'Irn-Bru XTRA', 'Irn-Bru', 'irn-bru', NULL, 'other', 'GB', 330, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),

  -- Red Bull
  ('seed-rb-original', 'Red Bull Energy Drink', 'Red Bull', 'red bull', NULL, 'energy', 'AT', 250, 'can', '9002490100070', 'caffeinated', 'full_sugar', 'The original energy drink.', NULL),
  ('seed-rb-sugarfree', 'Red Bull Sugarfree', 'Red Bull', 'red bull', NULL, 'energy', 'AT', 250, 'can', NULL, 'caffeinated', 'zero_sugar', NULL, NULL),
  ('seed-rb-tropical', 'Red Bull Tropical Edition', 'Red Bull', 'red bull', 'Tropical', 'energy', 'AT', 250, 'can', NULL, 'caffeinated', 'full_sugar', 'The Yellow Edition.', NULL),
  ('seed-rb-watermelon', 'Red Bull Red Edition', 'Red Bull', 'red bull', 'Watermelon', 'energy', 'AT', 250, 'can', NULL, 'caffeinated', 'full_sugar', NULL, NULL),

  -- UK independents and heritage brands
  ('seed-fent-curiosity', 'Fentimans Curiosity Cola', 'Fentimans', 'fentimans', 'Cola', 'cola', 'GB', 275, 'bottle_glass', NULL, 'caffeinated', 'full_sugar', 'Botanically brewed cola.', NULL),
  ('seed-fent-rose', 'Fentimans Rose Lemonade', 'Fentimans', 'fentimans', 'Rose', 'lemonade', 'GB', 275, 'bottle_glass', NULL, 'caffeine_free', 'full_sugar', 'Lemonade with rose otto.', NULL),
  ('seed-fent-ginger', 'Fentimans Ginger Beer', 'Fentimans', 'fentimans', 'Ginger', 'ginger_beer', 'GB', 275, 'bottle_glass', NULL, 'caffeine_free', 'full_sugar', NULL, NULL),
  ('seed-dalstons-lemon', 'Dalston''s Cloudy Lemonade', 'Dalston''s', 'dalston''s', 'Lemon', 'lemonade', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', 'Made with pressed lemons.', NULL),
  ('seed-dalstons-rhubarb', 'Dalston''s Rhubarb', 'Dalston''s', 'dalston''s', 'Rhubarb', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', NULL, NULL),
  ('seed-square-root-cola', 'Square Root Cola', 'Square Root', 'square root', 'Cola', 'cola', 'GB', 250, 'bottle_glass', NULL, 'caffeinated', 'full_sugar', 'Small-batch London soda.', NULL),
  ('seed-cawston-rhubarb', 'Cawston Press Sparkling Rhubarb', 'Cawston Press', 'cawston press', 'Rhubarb', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', 'Pressed fruit, no sweeteners.', NULL),
  ('seed-karma-cola', 'Karma Cola', 'Karma Drinks', 'karma drinks', 'Cola', 'cola', 'NZ', 300, 'bottle_glass', NULL, 'caffeinated', 'full_sugar', 'Fairtrade cola using Sierra Leonean cola nut.', NULL),
  ('seed-vimto', 'Vimto Original', 'Vimto', 'vimto', 'Mixed Fruit', 'fruit', 'GB', 500, 'bottle_plastic', NULL, 'caffeine_free', 'full_sugar', 'Grape, raspberry and blackcurrant.', NULL),
  ('seed-lilt', 'Lilt Pineapple & Grapefruit', 'Lilt', 'lilt', 'Pineapple & Grapefruit', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'reduced_sugar', 'Rebranded as Fanta in 2023 — a collector''s discontinued line.', NULL),
  ('seed-oldjam-ginger', 'Old Jamaica Ginger Beer', 'Old Jamaica', 'old jamaica', 'Ginger', 'ginger_beer', 'GB', 330, 'can', NULL, 'caffeine_free', 'full_sugar', 'Notably fiery.', NULL),
  ('seed-rubicon-mango', 'Rubicon Sparkling Mango', 'Rubicon', 'rubicon', 'Mango', 'fruit', 'GB', 330, 'can', NULL, 'caffeine_free', 'full_sugar', 'Made with Alphonso mangoes.', NULL),

  -- International
  ('seed-ting', 'Ting Grapefruit', 'Ting', 'ting', 'Grapefruit', 'citrus', 'JM', 330, 'can', NULL, 'caffeine_free', 'full_sugar', 'Jamaican sparkling grapefruit.', NULL),
  ('seed-ramune', 'Ramune Original', 'Hatakosen', 'hatakosen', NULL, 'lemonade', 'JP', 200, 'bottle_glass', NULL, 'caffeine_free', 'full_sugar', 'Codd-neck bottle sealed with a glass marble.', NULL),
  ('seed-jarritos-mandarin', 'Jarritos Mandarin', 'Jarritos', 'jarritos', 'Mandarin', 'fruit', 'MX', 370, 'bottle_glass', NULL, 'caffeine_free', 'full_sugar', 'Mexican soda made with cane sugar.', NULL),
  ('seed-jarritos-tamarind', 'Jarritos Tamarind', 'Jarritos', 'jarritos', 'Tamarind', 'fruit', 'MX', 370, 'bottle_glass', NULL, 'caffeine_free', 'full_sugar', NULL, NULL),
  ('seed-inca-kola', 'Inca Kola', 'Inca Kola', 'inca kola', 'Lemon Verbena', 'other', 'PE', 500, 'bottle_plastic', NULL, 'caffeinated', 'full_sugar', 'Peru''s golden national soft drink.', NULL),
  ('seed-thumsup', 'Thums Up', 'Thums Up', 'thums up', 'Cola', 'cola', 'IN', 300, 'bottle_glass', NULL, 'caffeinated', 'full_sugar', 'India''s strong-flavoured cola.', NULL),
  ('seed-sanpell-limonata', 'San Pellegrino Limonata', 'San Pellegrino', 'san pellegrino', 'Lemon', 'citrus', 'IT', 330, 'can', NULL, 'caffeine_free', 'full_sugar', 'Sicilian lemon.', NULL),
  ('seed-sanpell-aranciata', 'San Pellegrino Aranciata Rossa', 'San Pellegrino', 'san pellegrino', 'Blood Orange', 'citrus', 'IT', 330, 'can', NULL, 'caffeine_free', 'full_sugar', NULL, NULL),
  ('seed-club-mate', 'Club-Mate', 'Loscher', 'loscher', 'Yerba Mate', 'other', 'DE', 500, 'bottle_glass', NULL, 'caffeinated', 'reduced_sugar', 'Yerba mate soda, a hacker-scene staple.', NULL),

  -- Deliberately incomplete: name + brand only, as a user contribution would be.
  ('seed-incomplete-1', 'Cherry Cream Soda', 'Local Fizz Co', 'local fizz co', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'seed-user-demo'),
  ('seed-incomplete-2', 'Elderflower Pop', 'Hedgerow Sodas', 'hedgerow sodas', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'seed-user-ally');

-- ---------------------------------------------------------------------------
-- Ratings — each seed user rates roughly 60% of the catalogue, scored
-- 4.5..9.5 (stored as half-points 9..19). Gives the community-rating query
-- something realistic to average.
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
       9 + ((unicode(substr(d.id, -1)) * 19
             + unicode(substr(d.id, -3, 1)) * 31
             + unicode(substr(u.id, -2, 1)) * 11) % 11)
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
-- A starter collection for the demo user: everything they rated 7.5 or above.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO collection_entries (id, user_id, drink_id, is_favourite, notes)
SELECT 'seed-c-' || r.drink_id,
       r.user_id,
       r.drink_id,
       CASE WHEN r.score >= 18 THEN 1 ELSE 0 END,
       CASE WHEN r.score >= 19 THEN 'One of the best I have tried.' ELSE NULL END
FROM ratings r
WHERE r.user_id = 'seed-user-demo'
  AND r.score >= 15;
