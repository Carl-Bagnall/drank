-- Drank — the starting catalogue.
--
-- Real products only. No users, no ratings, no collection entries, so this is
-- safe to run against production: it cannot invent community scores or create
-- accounts nobody owns.
--
-- Upserted rather than deleted and reinserted. Deleting a drink would cascade
-- through ratings.drink_id and collection_entries.drink_id and destroy real
-- users' data, so re-running this is safe on a live database.
--
-- `created_by_user_id` is NULL throughout: these were not contributed by any
-- individual, and pointing them at a seed account that does not exist in
-- production would violate the foreign key.
--
-- This is the single list of drinks. seed/dev-extras.sql layers development
-- users and ratings on top of it rather than repeating it.

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
  ('seed-incomplete-1', 'Cherry Cream Soda', 'Local Fizz Co', 'local fizz co', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('seed-incomplete-2', 'Elderflower Pop', 'Hedgerow Sodas', 'hedgerow sodas', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
-- Upsert rather than delete-and-insert, so a drink row keeps its identity and
-- nothing referencing it is cascaded away. This is what makes the seed safe to
-- re-run against a database with real users in it.
ON CONFLICT(id) DO UPDATE SET
  name               = excluded.name,
  brand              = excluded.brand,
  brand_normalised   = excluded.brand_normalised,
  flavour            = excluded.flavour,
  category           = excluded.category,
  country            = excluded.country,
  volume_ml          = excluded.volume_ml,
  packaging          = excluded.packaging,
  barcode            = excluded.barcode,
  caffeine_status    = excluded.caffeine_status,
  sugar_status       = excluded.sugar_status,
  description        = excluded.description;
-- created_by_user_id is deliberately not updated: re-running must not clear
-- attribution if a drink was later credited to a real contributor.
