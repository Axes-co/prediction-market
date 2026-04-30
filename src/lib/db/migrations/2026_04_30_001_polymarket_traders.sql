-- ===========================================
-- Polymarket trader directory.
--
-- The existing `polymarket_users` table is keyed on the user's EOA
-- (`base_address`) and is populated only when we see both addresses
-- together — practically that means commenters, since the gamma comment
-- payload carries `userAddress` (EOA) and `proxyWallet` side by side.
--
-- Polymarket V2 itself identifies traders by their **proxy wallet**
-- (Safe address). The `/v1/leaderboard`, `/positions`, `/holders`,
-- `/activity` and `/builder/trades` endpoints all return `proxyWallet`
-- without an accompanying EOA. To import those users we need a
-- proxy-wallet-keyed directory.
--
-- This table is that directory. Keys on `proxy_wallet`, stores a snapshot
-- of the leaderboard-derived stats (pnl/vol per timePeriod) so the UI can
-- render trending/top-trader lists and quick profile cards without
-- round-tripping the Data API on every page.
--
-- Design choices:
--   - Single OVERALL category per row. Per-category breakdowns can come
--     later as a child table if the product calls for them.
--   - PnL/vol matrix flattened into named columns (`pnl_all`, `vol_all`,
--     `pnl_month`, etc.) instead of jsonb so we can index/sort without
--     functional indexes.
--   - `source` enum mirrors `polymarket_users` so future enrichment
--     paths (activity, holders) can populate the same table.
-- ===========================================

CREATE TABLE IF NOT EXISTS polymarket_traders (
  proxy_wallet            TEXT PRIMARY KEY,
  user_name               TEXT,
  profile_image           TEXT,
  x_username              TEXT,
  verified_badge          BOOLEAN,
  pnl_all                 NUMERIC,
  vol_all                 NUMERIC,
  pnl_month               NUMERIC,
  vol_month               NUMERIC,
  pnl_week                NUMERIC,
  vol_week                NUMERIC,
  pnl_day                 NUMERIC,
  vol_day                 NUMERIC,
  rank_pnl_all            INTEGER,
  rank_vol_all            INTEGER,
  first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                  TEXT NOT NULL DEFAULT 'leaderboard',
  CONSTRAINT polymarket_traders_proxy_wallet_lowercase_check
    CHECK (proxy_wallet = LOWER(proxy_wallet)),
  CONSTRAINT polymarket_traders_source_check
    CHECK (source IN ('leaderboard', 'activity', 'holders', 'comments', 'trades'))
);

CREATE INDEX IF NOT EXISTS polymarket_traders_pnl_all_idx
  ON polymarket_traders (pnl_all DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS polymarket_traders_vol_all_idx
  ON polymarket_traders (vol_all DESC NULLS LAST);
