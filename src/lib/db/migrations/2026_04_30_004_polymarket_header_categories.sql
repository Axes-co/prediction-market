-- ===========================================
-- Polymarket header category parity.
--
-- Verified against https://polymarket.com on 2026-04-30:
-- Trending, Breaking, New, Politics, Sports, Crypto, Esports, Iran, Finance,
-- Geopolitics, Tech, Culture, Economy, Weather, Mentions, Elections, More.
--
-- `Trending` and `New` are synthetic routes in the Next.js app. `Breaking`
-- is persisted as a main tag so `/breaking` is routable, then rendered between
-- Trending and New by `buildPlatformNavigationTags`.
-- ===========================================

WITH desired(name, slug, display_order) AS (
  VALUES
    ('Breaking', 'breaking', 0),
    ('Politics', 'politics', 1),
    ('Sports', 'sports', 2),
    ('Crypto', 'crypto', 3),
    ('Esports', 'esports', 4),
    ('Iran', 'iran', 5),
    ('Finance', 'finance', 6),
    ('Geopolitics', 'geopolitics', 7),
    ('Tech', 'tech', 8),
    ('Culture', 'culture', 9),
    ('Economy', 'economy', 10),
    ('Weather', 'weather', 11),
    ('Mentions', 'mentions', 12),
    ('Elections', 'elections', 13)
),
upserted AS (
  INSERT INTO tags (name, slug, is_main_category, display_order, is_hidden, hide_events)
  SELECT name, slug, TRUE, display_order, FALSE, FALSE
  FROM desired
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_main_category = TRUE,
    is_hidden = FALSE,
    hide_events = FALSE,
    updated_at = NOW()
  RETURNING slug
)
UPDATE tags
SET
  is_main_category = FALSE,
  updated_at = NOW()
WHERE is_main_category = TRUE
  AND slug NOT IN (SELECT slug FROM upserted);
