-- ===========================================
-- Polymarket V2 schema additions.
-- Source: docs/migration-polymarket/phase-19-final-master-plan.mdx PR-A2.
-- Adds gamma-derived columns we drop today, plus the polymarket_users mirror
-- we populate opportunistically from comments / activity / holders reads.
-- All changes are additive; existing rows keep their NULL/default values.
-- ===========================================

-- Per-event gamma metadata that the mapper currently drops.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gamma_event_id      INTEGER,
  ADD COLUMN IF NOT EXISTS comment_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS restricted          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS liquidity_clob      NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS featured            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_order      INTEGER;

CREATE INDEX IF NOT EXISTS events_gamma_event_id_idx
  ON events (gamma_event_id)
  WHERE gamma_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_featured_idx
  ON events (featured, featured_order)
  WHERE featured = TRUE;

-- Tag flags surfaced by gamma's /tags endpoint that drive home/nav curation.
ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS force_show          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS force_hide          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_carousel         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tags_is_carousel_idx
  ON tags (is_carousel)
  WHERE is_carousel = TRUE;

-- Read-mirror of every Polymarket address we observe in gamma comments,
-- data-api activity, and data-api holders. Keyed by base EOA so a user
-- with multiple Safes over time stays a single row.
CREATE TABLE IF NOT EXISTS polymarket_users (
  base_address              TEXT PRIMARY KEY,
  proxy_wallet              TEXT,
  pseudonym                 TEXT,
  name                      TEXT,
  display_username_public   BOOLEAN,
  bio                       TEXT,
  profile_image             TEXT,
  profile_image_optimized   TEXT,
  first_seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                    TEXT NOT NULL,
  CONSTRAINT polymarket_users_base_address_lowercase_check
    CHECK (base_address = LOWER(base_address)),
  CONSTRAINT polymarket_users_proxy_wallet_lowercase_check
    CHECK (proxy_wallet IS NULL OR proxy_wallet = LOWER(proxy_wallet)),
  CONSTRAINT polymarket_users_source_check
    CHECK (source IN ('comments', 'activity', 'holders', 'leaderboard', 'trades'))
);

CREATE INDEX IF NOT EXISTS polymarket_users_proxy_wallet_idx
  ON polymarket_users (proxy_wallet)
  WHERE proxy_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS polymarket_users_last_seen_at_idx
  ON polymarket_users (last_seen_at);
