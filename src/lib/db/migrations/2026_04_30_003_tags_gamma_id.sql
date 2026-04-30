-- ===========================================
-- Tag table parity with Polymarket Gamma's `Tag` schema
-- (https://gamma-api.polymarket.com/tags).
--
-- Gamma's Tag has: id, label, slug, forceShow, forceHide, isCarousel,
-- publishedAt, createdBy, updatedBy, createdAt, updatedAt.
--
-- We already store: name (← label), slug, force_show, force_hide,
-- is_carousel, published_at. Missing: the upstream `id` (Polymarket's gamma
-- tag id, distinct from our internal SERIAL `id`). Without it we cannot
-- cross-reference back to Polymarket (e.g. to call `/events/{id}/tags` or
-- compare against Polymarket's nav source of truth).
--
-- `createdBy` and `updatedBy` are internal Polymarket admin user IDs and
-- carry no value to us, so we deliberately do NOT mirror them.
-- ===========================================

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS gamma_tag_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tags_gamma_tag_id_uidx
  ON tags (gamma_tag_id)
  WHERE gamma_tag_id IS NOT NULL;
