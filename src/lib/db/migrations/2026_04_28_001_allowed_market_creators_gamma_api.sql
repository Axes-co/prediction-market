-- ===========================================
-- Extend allowed_market_creators to support a third source type:
-- gamma_api (a Polymarket-compatible Gamma API endpoint).
-- ===========================================

ALTER TABLE allowed_market_creators
  DROP CONSTRAINT IF EXISTS allowed_market_creators_wallet_address_check;

ALTER TABLE allowed_market_creators
  ADD CONSTRAINT allowed_market_creators_wallet_address_check
  CHECK (
    wallet_address ~ '^0x[0-9a-f]{40}$'
    OR wallet_address LIKE 'gamma:%'
  );

ALTER TABLE allowed_market_creators
  DROP CONSTRAINT IF EXISTS allowed_market_creators_source_type_check;

ALTER TABLE allowed_market_creators
  ADD CONSTRAINT allowed_market_creators_source_type_check
  CHECK (source_type IN ('site', 'wallet', 'gamma_api'));

ALTER TABLE allowed_market_creators
  DROP CONSTRAINT IF EXISTS allowed_market_creators_source_url_check;

ALTER TABLE allowed_market_creators
  ADD CONSTRAINT allowed_market_creators_source_url_check
  CHECK (
    (source_type = 'site' AND source_url IS NOT NULL)
    OR (source_type = 'wallet' AND source_url IS NULL)
    OR (source_type = 'gamma_api' AND source_url IS NOT NULL)
  );
