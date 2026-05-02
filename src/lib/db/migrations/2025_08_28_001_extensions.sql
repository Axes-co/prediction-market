CREATE SCHEMA IF NOT EXISTS extensions;

-- pg_net + pg_cron are Supabase-specific conveniences we no longer rely on
-- (Vercel cron triggers all sync routes; we left the legacy pg_net/pg_cron
-- code paths so existing Supabase deployments don't see CREATE EXTENSION
-- errors during re-runs). Both fail outright on other Postgres providers:
--   * Neon: `pg_available_extensions` reports pg_cron available, but it
--     can only be installed in the database matching cron.database_name
--     (defaults to 'postgres'); on Neon the user database is 'neondb' so
--     CREATE EXTENSION raises P0001 "can only create extension in
--     database postgres".
--   * Neon / RDS / self-hosted: pg_net not packaged.
-- Wrap each in an exception block so a missing/unsupported extension is
-- a notice, not a migration-blocking failure.
DO
$$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipping pg_net (not installable here): %', SQLERRM;
      END;
    END IF;
  END
$$;

DO
$$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipping pg_cron (not installable in this database): %. Vercel cron handles scheduling.', SQLERRM;
      END;
    END IF;
  END
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;
