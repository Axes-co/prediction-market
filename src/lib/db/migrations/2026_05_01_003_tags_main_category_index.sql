-- Index the filter+sort columns on `tags` so loadPlatformMainTags's
-- `SELECT ... WHERE is_main_category=TRUE AND is_hidden=FALSE
-- ORDER BY display_order, name` doesn't fall back to a heap scan.
--
-- Why this matters now. Postgres MVCC scans need to consult the
-- visibility map for each row checked. The `tags` table is the hottest
-- write target during the gamma cron (per-tick upserts on every event's
-- linked tags). Under that write pressure, a 1.1k-row heap scan that
-- normally completes in <1ms grows past Supabase's 8s statement_timeout
-- (`code: '57014'`), Postgres kills the query, and the Vercel prerender
-- errors with USE_CACHE_TIMEOUT inside loadPlatformMainTags. This was
-- the actual blocker on the last 5 deploy attempts (verified in build
-- logs 2026-05-01).
--
-- The partial index targets the exact predicate the loader uses, so the
-- index footprint is tiny (only main-category visible rows) and the
-- planner sees an obvious index-only scan. Sort by display_order, name
-- is satisfied in-index too.
--
-- statement_timeout / lock_timeout overrides: CREATE INDEX takes an
-- ACCESS EXCLUSIVE lock on `tags`, and the gamma cron upserts every
-- event's tag links on every tick (~once a minute). Under contention
-- the lock-wait clock starts ticking against Supabase's default 8s
-- statement_timeout and the migration aborts with `code: '57014'`
-- before it can ever acquire the lock. The actual write of a 1.1k-row
-- partial index is sub-second once the lock is in hand, so a 5-minute
-- ceiling is generous in both directions.
SET LOCAL lock_timeout = '5min';
SET LOCAL statement_timeout = '5min';

CREATE INDEX IF NOT EXISTS idx_tags_main_visible_order_name
  ON tags (display_order, name)
  WHERE is_main_category = TRUE AND is_hidden = FALSE;
