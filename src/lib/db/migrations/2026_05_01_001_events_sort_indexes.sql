-- ===========================================
-- Indexes for the homepage sort orders.
--
-- Today's gamma sync grew the events table from ~128 rows yesterday to
-- ~1,675 rows. The /new page sorts by `events.created_at DESC` and the
-- /trending homepage sorts by 24h-volume + `events.created_at DESC` as
-- the secondary key. With only `idx_events_volume_desc` and
-- `idx_events_open_interest_desc` previously in place (added by
-- 2026_04_30_002_gamma_field_parity), the planner had to scan + sort
-- 1,675 events × 40+ joined market rows for sports events, which
-- pushed each prerender past Next.js's cache-fill timeout during
-- `next build` and produced USE_CACHE_TIMEOUT errors on /[locale]/new
-- and /[locale]/sports/live.
--
-- These indexes give the planner cheap, sorted access for both home
-- sort orders without a full table scan.
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_events_created_at_desc
  ON events (created_at DESC);

-- The trending homepage frequently does ORDER BY (volume_24h sum) DESC,
-- created_at DESC. The volume sum is computed in a correlated subquery, so
-- a multicolumn index on events isn't a clean fit; the covering index above
-- on created_at handles the secondary key cheaply. Status is filtered first
-- by the planner so a partial index on (status, created_at DESC) helps the
-- common active-events scan.
CREATE INDEX IF NOT EXISTS idx_events_status_created_at_desc
  ON events (status, created_at DESC);

-- /[locale]/(platform)/(home)/page.tsx and `loadHomeEventCandidates` walk
-- the events list ordered by `events.id DESC` as a fallback. id is the
-- primary key so it's already indexed, but a compound (status, id DESC)
-- index is small and cuts the per-tag slug filter from full scan to a
-- bounded range.
CREATE INDEX IF NOT EXISTS idx_events_status_id_desc
  ON events (status, id DESC);
