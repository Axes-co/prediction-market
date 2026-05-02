#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const postgres = require('postgres')

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, '\'\'')
}

function resolveSupabaseMode(env = process.env) {
  // Supabase mode controls migration SQL rewriting: when true, leave
  // `TO service_role` grants intact; when false, rewrite to `TO CURRENT_USER`.
  // Detection has to look at the ACTUAL database the migrations target,
  // not at any `SUPABASE_*` env var presence -- those env vars stay set
  // for auth/storage features even when the DB itself has moved to a
  // different provider (e.g., Neon).
  const databaseUrl = (env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || '').trim()
  if (!databaseUrl) {
    // No DB URL at all => not on Supabase. Caller will skip migration anyway.
    return false
  }

  const isSupabaseHost = /\.supabase\.(?:co|com)\b/i.test(databaseUrl)
    || /pooler\.supabase\.(?:co|com)\b/i.test(databaseUrl)
  if (!isSupabaseHost) {
    return false
  }

  // We're targeting a Supabase DB; require the matching service_role key
  // since the migrations create policies that grant TO service_role.
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseServiceRoleKey) {
    throw new Error('POSTGRES_URL points at Supabase but SUPABASE_SERVICE_ROLE_KEY is not set; migrations need it to grant policies to the service_role role.')
  }
  return true
}

function rewriteMigrationSqlForMode(migrationSql, isSupabase) {
  if (isSupabase) {
    return migrationSql
  }

  // Replace `TO "service_role"` and `TO service_role` (Supabase-specific
  // role) with `TO CURRENT_USER` so policies/grants apply against whatever
  // user the connection is using on Postgres providers that don't ship
  // service_role (Neon, RDS, self-hosted). The trailing `\b` from the
  // earlier version did not match after a closing double-quote followed
  // by a space (both non-word), so quoted occurrences slipped through.
  return migrationSql
    .replace(/\bTO\s+"service_role"/gi, 'TO CURRENT_USER')
    .replace(/\bTO\s+service_role\b/gi, 'TO CURRENT_USER')
}

async function withReservedTransaction(sql, fn) {
  await sql`BEGIN`

  try {
    const result = await fn(sql)
    await sql`COMMIT`
    return result
  }
  catch (error) {
    try {
      await sql`ROLLBACK`
    }
    catch (rollbackError) {
      console.error('Failed to roll back migration transaction:', rollbackError)
    }

    throw error
  }
}

async function applyMigrations(sql, isSupabase) {
  console.log('Applying migrations...')

  console.log('Creating migrations tracking table...')
  const migrationsPolicyRole = isSupabase ? 'service_role' : 'CURRENT_USER'
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;

    DO
    $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_migrations' AND tablename = 'migrations') THEN
          CREATE POLICY "service_role_all_migrations" ON migrations FOR ALL TO ${migrationsPolicyRole} USING (TRUE) WITH CHECK (TRUE);
        END IF;
      END
    $$;
  `, [], { simple: true })
  console.log('Migrations table ready')

  const migrationsDir = path.join(__dirname, '../src/lib/db/migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()

  console.log(`Found ${migrationFiles.length} migration files`)

  for (const file of migrationFiles) {
    const version = file.replace('.sql', '')

    const result = await sql`
      SELECT version FROM migrations WHERE version = ${version}
    `

    if (result.length > 0) {
      console.log(`⏭️ Skipping ${file} (already applied)`)
      continue
    }

    console.log(`🔄 Applying ${file}`)
    const rawMigrationSql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8',
    )
    const migrationSql = rewriteMigrationSqlForMode(rawMigrationSql, isSupabase)

    if (!isSupabase && rawMigrationSql !== migrationSql) {
      console.log(`ℹ️ Applied compatibility rewrite for ${file} (service_role -> CURRENT_USER)`)
    }

    await withReservedTransaction(sql, async (tx) => {
      await tx.unsafe(migrationSql, [], { simple: true })
      await tx`INSERT INTO migrations (version) VALUES (${version})`
    })

    console.log(`✅ Applied ${file}`)
  }

  console.log('✅ All migrations applied successfully')
}

async function createCleanCronDetailsCron(sql) {
  console.log('Creating clean cron details job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      DELETE FROM cron.job_run_details
      WHERE start_time < now() - interval '1 day';
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'clean-cron-details';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('clean-cron-details', '0 0 * * *', cmd);
  END $$;`

  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log('✅ Cron clean-cron-details created successfully')
}

async function createCleanJobsCron(sql) {
  console.log('Creating clean-jobs cron job...')
  const sqlQuery = `
  DO $$
  DECLARE
    job_id int;
    cmd text := $c$
      UPDATE jobs
      SET
        status = 'pending',
        available_at = NOW(),
        reserved_at = NULL,
        last_error = CASE
          WHEN COALESCE(last_error, '') = '' THEN '[Recovered stale processing job]'
          ELSE last_error || ' [Recovered stale processing job]'
        END
      WHERE status = 'processing'
        AND (
          reserved_at IS NULL
          OR reserved_at < NOW() - interval '30 minutes'
        );

      DELETE FROM jobs
      WHERE status = 'completed'
        AND updated_at < NOW() - interval '14 days';

      DELETE FROM jobs
      WHERE status = 'failed'
        AND updated_at < NOW() - interval '30 days';
    $c$;
  BEGIN
    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'clean-jobs';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    PERFORM cron.schedule('clean-jobs', '15 * * * *', cmd);
  END $$;`

  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log('✅ Cron clean-jobs created successfully')
}

// Legacy pg_cron job names that earlier deploys registered. They are now
// either deprecated (`sync-events` was the Goldsky V1 reader, `sync-volume`
// was the V1 volume crawler, `sync-event-creations` was the kuest market
// authoring worker) or duplicated by `vercel.json` crons. We unschedule them
// at every `db:push` so the post-Polymarket-V2 deploy converges to a single
// scheduler (Vercel cron) regardless of how many old jobs the database has
// accumulated.
const LEGACY_PG_CRON_JOB_NAMES = [
  'sync-events',
  'sync-volume',
  'sync-event-creations',
  'sync-translations',
  'sync-resolution',
]

async function unscheduleLegacyPgCronJobs(sql) {
  console.log('Unscheduling legacy pg_cron sync jobs...')
  const sqlQuery = `
  DO $$
  DECLARE
    target_job text;
    job_id int;
  BEGIN
    FOREACH target_job IN ARRAY ARRAY[${LEGACY_PG_CRON_JOB_NAMES.map(name => `'${escapeSqlLiteral(name)}'`).join(', ')}]
    LOOP
      SELECT jobid INTO job_id FROM cron.job WHERE jobname = target_job;
      IF job_id IS NOT NULL THEN
        PERFORM cron.unschedule(job_id);
        RAISE NOTICE 'Unscheduled %', target_job;
      END IF;
    END LOOP;
  END $$;`

  await sql.unsafe(sqlQuery, [], { simple: true })
  console.log('✅ Legacy pg_cron sync jobs unscheduled')
}

async function ensureSyncSeedRows(sql) {
  // The seed migration `2026_04_01_001_subgraph_syncs_integer_id.sql` inserts
  // the rows below, but if they get deleted manually (or the migration tracker
  // says applied without the rows persisting), the legacy lock-acquisition
  // code throws. Re-seed unconditionally on every db:push so the rows are
  // always present.
  console.log('Ensuring subgraph_syncs seed rows...')
  await sql.unsafe(`
    INSERT INTO subgraph_syncs (service_name, subgraph_name, status, total_processed, error_message)
    VALUES
      ('market_sync', 'pnl', 'idle', 0, NULL),
      ('resolution_sync', 'resolution', 'idle', 0, NULL)
    ON CONFLICT (service_name, subgraph_name) DO NOTHING;
  `, [], { simple: true })
  console.log('✅ subgraph_syncs seed rows ensured')
}

async function resolveCronExtensionCapabilities(sql) {
  const result = await sql`
    SELECT
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS has_pg_cron,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') AS has_pg_net
  `

  return {
    hasPgCron: Boolean(result[0]?.has_pg_cron),
    hasPgNet: Boolean(result[0]?.has_pg_net),
  }
}

async function configureSupabaseScheduler(sql) {
  const { hasPgCron } = await resolveCronExtensionCapabilities(sql)

  if (!hasPgCron) {
    console.log('Skipping scheduler setup because pg_cron is not installed in this database.')
    return
  }

  // DB maintenance jobs stay in pg_cron — they don't make HTTP calls and have
  // nothing to do with the Vercel scheduler.
  await createCleanCronDetailsCron(sql)
  await createCleanJobsCron(sql)

  // All sync endpoints (`/api/sync/gamma`, `/api/sync/tags`, etc.) are
  // scheduled via `vercel.json` cron now. Unschedule any pg_cron jobs left
  // over from earlier deploys so we don't double-fire the routes from inside
  // Postgres in addition to Vercel's scheduler.
  await unscheduleLegacyPgCronJobs(sql)
}

function resolveMigrationConnectionString() {
  // Prefer POSTGRES_URL_NON_POOLING (Vercel/Neon canonical name for the
  // direct DB URL). Fall back to POSTGRES_URL.
  //
  // We deliberately do NOT rewrite the port to 5432 anymore. The previous
  // implementation forced session-mode (port 5432) so it could call
  // `pg_advisory_lock`, but that pool has a hard cap at the per-tier Pool
  // Size (~15 on smaller Supabase compute instances). Under any load --
  // active syncs, wallet-balance polling, lingering build attempts -- the
  // 15 slots fill, every new build hits ECHECKOUTTIMEOUT in Session mode,
  // and migrations never run.
  //
  // Transaction-mode pooler (port 6543) accepts ~200 concurrent client
  // connections. We use it directly. The advisory lock is gone (replaced
  // by the row-based lock in `acquireMigrationLock` below) and migrations
  // are wrapped in transactions, which is exactly the workload pgbouncer
  // transaction-mode is designed for.
  return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || null
}

// Row-based migration lock. Replaces the previous `pg_advisory_lock`
// implementation, which required session-mode pooling. Uses a single-row
// table; INSERT/DELETE are atomic, ON CONFLICT prevents double-acquire.
//
// Stale lock recovery: if a previous build crashed mid-migration without
// releasing, the row stays. We treat any lock acquired more than 15 minutes
// ago as stale and reclaim it (`INTERVAL '15 minutes'` in the SQL below).
// Vercel build timeout is shorter than that in practice, so a real
// concurrent build is essentially impossible -- a build that's been
// running 15+ minutes has already been killed by Vercel.
const MIGRATION_LOCK_HOLDER = `vercel-build-${process.env.VERCEL_DEPLOYMENT_ID || process.pid}`

async function ensureMigrationLockTable(sql) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS migration_locks (
      id           INTEGER PRIMARY KEY,
      holder       TEXT NOT NULL,
      acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

async function acquireMigrationLock(sql) {
  await ensureMigrationLockTable(sql)

  // Insert if absent. If a stale row exists, take it over.
  const result = await sql`
    INSERT INTO migration_locks (id, holder, acquired_at)
    VALUES (1, ${MIGRATION_LOCK_HOLDER}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET holder = EXCLUDED.holder,
          acquired_at = NOW()
      WHERE migration_locks.acquired_at < NOW() - INTERVAL '15 minutes'
    RETURNING holder
  `
  if (result.length === 0) {
    const existing = await sql`SELECT holder, acquired_at FROM migration_locks WHERE id = 1`
    const detail = existing[0]
      ? `held by ${existing[0].holder} since ${existing[0].acquired_at?.toISOString?.() ?? existing[0].acquired_at}`
      : 'unknown holder'
    throw new Error(`Migration lock already held (${detail}). If this is wrong, manually DELETE FROM migration_locks WHERE id = 1.`)
  }
}

async function releaseMigrationLock(sql) {
  await sql`DELETE FROM migration_locks WHERE id = 1 AND holder = ${MIGRATION_LOCK_HOLDER}`
}

async function run() {
  const connectionString = resolveMigrationConnectionString()
  if (!connectionString) {
    console.log('Skipping db:push because required env vars are missing: POSTGRES_URL_NON_POOLING or POSTGRES_URL')
    return
  }

  const requiresSsl = connectionString.includes('sslmode=require')
    || connectionString.includes('neon.tech')
  // `prepare: false` is required for pgbouncer transaction-mode (it
  // rotates underlying backend connections per transaction, so prepared
  // statements registered on one connection won't exist on the next).
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    connect_timeout: 30,
    idle_timeout: 5,
    ...(requiresSsl ? { ssl: 'require' } : {}),
  })
  let lockAcquired = false

  try {
    const isSupabaseMode = resolveSupabaseMode(process.env)

    console.log('Connecting to database...')
    await sql`SELECT 1`
    console.log('Connected to database successfully')

    console.log('Acquiring migration lock...')
    await acquireMigrationLock(sql)
    lockAcquired = true
    console.log('Migration lock acquired')

    console.log(`Migration mode: ${isSupabaseMode ? 'Supabase' : 'Postgres+S3'}`)
    await applyMigrations(sql, isSupabaseMode)
    await ensureSyncSeedRows(sql)

    if (isSupabaseMode) {
      await configureSupabaseScheduler(sql)
    }
    else {
      console.log('Skipping database scheduler setup because Supabase mode is not configured. Sync routes are scheduled via vercel.json cron.')
    }
  }
  catch (error) {
    console.error('An error occurred:', error)
    process.exitCode = 1
  }
  finally {
    if (sql) {
      if (lockAcquired) {
        try {
          console.log('Releasing migration lock...')
          await releaseMigrationLock(sql)
          console.log('Migration lock released')
        }
        catch (error) {
          console.error('Failed to release migration lock:', error)
        }
      }
    }

    console.log('Closing database connection...')
    await sql.end()
    console.log('Connection closed.')
  }
}

run()
