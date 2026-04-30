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
  slug_match_id SMALLINT;
  name_match_id SMALLINT;
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
    SELECT id INTO slug_match_id
    FROM tags
    WHERE slug = desired_record.slug;

    SELECT id INTO name_match_id
    FROM tags
    WHERE name = desired_record.name;

    IF slug_match_id IS NOT NULL
      AND name_match_id IS NOT NULL
      AND slug_match_id <> name_match_id THEN
      -- Both unique keys already exist on different rows. Merge the stale
      -- name row into the canonical slug row before realigning the canonical
      -- row's name, otherwise the update below can still trip tags_name_key.
      INSERT INTO event_tags (event_id, tag_id)
      SELECT event_id, slug_match_id
      FROM event_tags
      WHERE tag_id = name_match_id
      ON CONFLICT DO NOTHING;

      INSERT INTO tag_translations (tag_id, locale, name, source_hash, is_manual)
      SELECT slug_match_id, locale, name, source_hash, is_manual
      FROM tag_translations
      WHERE tag_id = name_match_id
      ON CONFLICT (tag_id, locale) DO NOTHING;

      UPDATE tags AS canonical
      SET gamma_tag_id = CASE
            WHEN canonical.gamma_tag_id IS NULL THEN duplicate.gamma_tag_id
            ELSE canonical.gamma_tag_id
          END,
          updated_at = NOW()
      FROM tags AS duplicate
      WHERE canonical.id = slug_match_id
        AND duplicate.id = name_match_id;

      DELETE FROM tags
      WHERE id = name_match_id;

      name_match_id := slug_match_id;
    END IF;

    IF slug_match_id IS NOT NULL THEN
      -- Slug match: row already keyed on the desired slug. Realign name and flags.
      UPDATE tags
      SET name = desired_record.name,
          is_main_category = TRUE,
          display_order = desired_record.display_order,
          is_hidden = FALSE,
          hide_events = FALSE,
          updated_at = NOW()
      WHERE id = slug_match_id;

    ELSIF name_match_id IS NOT NULL THEN
      -- Slug missing but name might already exist with a stale slug. Migrate it.
      UPDATE tags
      SET slug = desired_record.slug,
          is_main_category = TRUE,
          display_order = desired_record.display_order,
          is_hidden = FALSE,
          hide_events = FALSE,
          updated_at = NOW()
      WHERE id = name_match_id;

    ELSE
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
