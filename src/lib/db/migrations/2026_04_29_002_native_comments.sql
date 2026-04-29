-- ===========================================
-- Native comments stack — Axes-owned community.
-- Replaces the kuest community.kuest dependency: comments live in our DB,
-- our /api/comments routes read+write, the gamma seed cron just pre-populates
-- so the community looks alive on day-1.
-- ===========================================

CREATE TABLE IF NOT EXISTS comments (
  id                   CHAR(26) PRIMARY KEY DEFAULT generate_ulid(),
  event_id             CHAR(26) NOT NULL
                         REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE,
  parent_comment_id    CHAR(26)
                         REFERENCES comments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  author_base_address  TEXT NOT NULL
                         REFERENCES polymarket_users(base_address) ON DELETE CASCADE ON UPDATE CASCADE,
  body                 TEXT NOT NULL,
  reactions_count      INTEGER NOT NULL DEFAULT 0,
  reports_count        INTEGER NOT NULL DEFAULT 0,
  external_source      TEXT NOT NULL,                  -- 'gamma_seed' | 'native'
  external_id          TEXT,                           -- gamma comment id when seeded
  is_hidden            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comments_external_source_check
    CHECK (external_source IN ('gamma_seed', 'native')),
  CONSTRAINT comments_external_id_native_null_check
    CHECK (
      (external_source = 'native' AND external_id IS NULL)
      OR (external_source = 'gamma_seed' AND external_id IS NOT NULL)
    ),
  CONSTRAINT comments_author_lowercase_check
    CHECK (author_base_address = LOWER(author_base_address)),
  CONSTRAINT comments_body_length_check
    CHECK (char_length(body) BETWEEN 1 AND 2000)
);

-- Idempotent seed: a single gamma comment can only land once per
-- (external_source, external_id). Native comments use external_id IS NULL
-- and Postgres treats NULL as distinct in unique indexes, so they coexist
-- without conflict. Non-partial keeps the index compatible with `ON CONFLICT
-- (external_source, external_id) DO NOTHING` from Drizzle.
CREATE UNIQUE INDEX IF NOT EXISTS comments_external_id_unique
  ON comments (external_source, external_id);

CREATE INDEX IF NOT EXISTS comments_event_id_created_at_idx
  ON comments (event_id, created_at DESC)
  WHERE is_hidden = FALSE;

CREATE INDEX IF NOT EXISTS comments_parent_comment_id_idx
  ON comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_author_idx
  ON comments (author_base_address);

CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id           CHAR(26) NOT NULL
                         REFERENCES comments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  reactor_base_address TEXT NOT NULL
                         REFERENCES polymarket_users(base_address) ON DELETE CASCADE ON UPDATE CASCADE,
  reaction_type        TEXT NOT NULL DEFAULT 'like',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, reactor_base_address, reaction_type),
  CONSTRAINT comment_reactions_reactor_lowercase_check
    CHECK (reactor_base_address = LOWER(reactor_base_address))
);

CREATE INDEX IF NOT EXISTS comment_reactions_comment_idx
  ON comment_reactions (comment_id);
