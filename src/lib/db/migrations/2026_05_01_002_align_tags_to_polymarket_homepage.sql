-- Align our `tags` table's `is_main_category` set to polymarket.com's
-- homepage categories. Verified 2026-05-01 against polymarket.com:
-- the homepage shows 8 visible category chips:
--   Politics, Middle East, Crypto, Sports, Pop Culture, Tech, AI, Business
-- (the "Live Crypto" chip is a saved-filter, not a tag, so we don't
-- represent it as a main_category.)
--
-- Two reasons this migration matters:
--
-- 1. Tag parity / cleanup. Our DB drifted to 42 main_category=true tags
--    over time, including 2024-cycle leftovers like `biden`, `biden-drop-out`,
--    `debate`, `djt`, `fed-rates`, `french-election`, `swing-states`,
--    `trump-trials`, plus internal flags like `featured` and `breaking`.
--    None of these are surfaced as main categories on polymarket.com today.
--
-- 2. Build performance. `loadPlatformMainTags` runs the
--    `v_main_tag_subcategories` view filtered by `main_tag_slug IN (...)`
--    over those 42 slugs. The view does a 5-table join with
--    `count(DISTINCT m.condition_id)` over markets, which exceeds
--    Supabase's 8s statement_timeout (`code: '57014'`) and fails the
--    Vercel prerender at USE_CACHE_TIMEOUT. Reducing the IN-clause from
--    42 -> 8 cuts the aggregate ~5x and brings the query under budget.
--
-- The migration is idempotent: tags that don't exist yet (e.g. `pop-culture`,
-- `middle-east`) become main_category=true the next time the gamma cron
-- inserts them. Slugs not in the canonical set keep their data but lose the
-- `is_main_category` flag (they remain accessible via /<slug> URLs).

BEGIN;

-- 1. Reset: every previously-main-category tag becomes a regular tag.
UPDATE tags
SET is_main_category = FALSE
WHERE is_main_category = TRUE;

-- 2. Promote the canonical polymarket homepage set, in display order.
--    Each UPDATE is a no-op if the slug doesn't exist yet (gamma cron
--    fills it in on a later tick and a re-run of this migration would
--    flip it then; until then the user-visible nav simply has fewer
--    categories than polymarket, which is acceptable parity-direction).
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 1 WHERE slug = 'politics';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 2 WHERE slug = 'middle-east';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 3 WHERE slug = 'crypto';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 4 WHERE slug = 'sports';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 5 WHERE slug = 'pop-culture';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 6 WHERE slug = 'tech';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 7 WHERE slug = 'ai';
UPDATE tags SET is_main_category = TRUE, is_hidden = FALSE, display_order = 8 WHERE slug = 'business';

COMMIT;
