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
--
-- The `tags` table has TWO unique constraints (name, slug). A naive
-- INSERT ... ON CONFLICT (slug) DO UPDATE only catches one of them, so when
-- the DB already has a row with the same `name` but a different `slug`
-- (e.g., a kuest-era seed with slug='culture-legacy'), the INSERT bypasses
-- the slug check and trips on `tags_name_key`. Resolve by trying slug match
-- first, then name match, then insert — never causing both keys to collide
-- in the same statement.
-- ===========================================

DO
$$
DECLARE
  desired_record RECORD;
BEGIN
  FOR desired_record IN
    SELECT * FROM (VALUES
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
    ) AS t(name, slug, display_order)
  LOOP
    -- Slug match: row already keyed on the desired slug. Realign name and flags.
    UPDATE tags
    SET name = desired_record.name,
        is_main_category = TRUE,
        display_order = desired_record.display_order,
        is_hidden = FALSE,
        hide_events = FALSE,
        updated_at = NOW()
    WHERE slug = desired_record.slug;

    IF NOT FOUND THEN
      -- Slug missing but name might already exist with a stale slug. Migrate it.
      UPDATE tags
      SET slug = desired_record.slug,
          is_main_category = TRUE,
          display_order = desired_record.display_order,
          is_hidden = FALSE,
          hide_events = FALSE,
          updated_at = NOW()
      WHERE name = desired_record.name;

      IF NOT FOUND THEN
        -- Neither key exists. Insert fresh.
        INSERT INTO tags (name, slug, is_main_category, display_order, is_hidden, hide_events)
        VALUES (
          desired_record.name,
          desired_record.slug,
          TRUE,
          desired_record.display_order,
          FALSE,
          FALSE
        );
      END IF;
    END IF;
  END LOOP;

  -- Demote any other rows still flagged as main categories. Migrations table
  -- guards against re-runs, so this only enforces parity once; admin can add
  -- new main categories afterwards and they will persist.
  UPDATE tags
  SET is_main_category = FALSE,
      updated_at = NOW()
  WHERE is_main_category = TRUE
    AND slug NOT IN (
      'breaking', 'politics', 'sports', 'crypto', 'esports', 'iran',
      'finance', 'geopolitics', 'tech', 'culture', 'economy', 'weather',
      'mentions', 'elections'
    );
END
$$;
