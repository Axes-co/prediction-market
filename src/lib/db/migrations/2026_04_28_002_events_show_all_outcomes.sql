-- ===========================================
-- Add events.show_all_outcomes
-- Mirrors Polymarket gamma's `showAllOutcomes` event flag. When true, the
-- event chart should render the top markets' YES probabilities even when
-- the resolution mechanism is independent (not negRisk). Default false to
-- preserve the existing kuest "hide chart for multi-market non-negRisk" gate.
-- ===========================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS show_all_outcomes BOOLEAN NOT NULL DEFAULT false;
