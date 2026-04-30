-- ===========================================
-- Polymarket Gamma response field parity.
--
-- The original mapper captured a minimum-viable subset of the Gamma response.
-- Production data showed the gap: event cards displayed no probability until
-- a CLOB call landed, volume metrics only covered 24 hours, fee schedules
-- weren't available, and trading-config fields (`acceptingOrders`,
-- `orderMinSize`, `orderPriceMinTickSize`) had to be hardcoded in the UI.
--
-- This migration adds the missing columns. All changes are additive — every
-- new column is nullable or has a sensible default, so existing rows keep
-- working until the next sync pass refreshes them with real Gamma values.
-- ===========================================

-- ---- events ----------------------------------------------------------------

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS volume                   NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_24h               NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_week              NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_month             NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_year              NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS open_interest            NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS liquidity                NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS competitive              NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS ticker                   TEXT,
  ADD COLUMN IF NOT EXISTS enable_order_book        BOOLEAN,
  ADD COLUMN IF NOT EXISTS gamma_active             BOOLEAN,
  ADD COLUMN IF NOT EXISTS gamma_closed             BOOLEAN,
  ADD COLUMN IF NOT EXISTS gamma_archived           BOOLEAN,
  ADD COLUMN IF NOT EXISTS creation_date            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gamma_updated_at         TIMESTAMPTZ;

-- Volume sort lookup needs to land here too — Polymarket's primary sort is
-- by lifetime `volume` and the homepage / category lists query the same.
CREATE INDEX IF NOT EXISTS idx_events_volume_desc
  ON events (volume DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_events_open_interest_desc
  ON events (open_interest DESC NULLS LAST);

-- ---- markets ---------------------------------------------------------------

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS gamma_market_id          INTEGER,
  ADD COLUMN IF NOT EXISTS outcome_prices           JSONB,
  ADD COLUMN IF NOT EXISTS last_trade_price         NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS best_bid                 NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS best_ask                 NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS spread                   NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS one_week_price_change    NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS one_month_price_change   NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS competitive              NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS accepting_orders         BOOLEAN,
  ADD COLUMN IF NOT EXISTS accepting_orders_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enable_order_book        BOOLEAN,
  ADD COLUMN IF NOT EXISTS order_price_min_tick_size NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS order_min_size           NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS group_item_threshold     NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS liquidity                NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS liquidity_clob           NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_week              NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_month             NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_year              NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_clob              NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_24h_clob          NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_week_clob         NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_month_clob        NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS volume_year_clob         NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS uma_bond                 NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS uma_reward               NUMERIC(30, 6),
  ADD COLUMN IF NOT EXISTS fee_type                 TEXT,
  ADD COLUMN IF NOT EXISTS fee_schedule             JSONB,
  ADD COLUMN IF NOT EXISTS fees_enabled             BOOLEAN,
  ADD COLUMN IF NOT EXISTS restricted               BOOLEAN,
  ADD COLUMN IF NOT EXISTS featured                 BOOLEAN;

-- Trade-state fields the order panel reads on every render.
CREATE INDEX IF NOT EXISTS idx_markets_accepting_orders
  ON markets (accepting_orders)
  WHERE accepting_orders IS NOT NULL;

-- ---- outcomes --------------------------------------------------------------

ALTER TABLE outcomes
  ADD COLUMN IF NOT EXISTS price                    NUMERIC(10, 6);
