import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './db/schema'

type DrizzleDb = PostgresJsDatabase<typeof schema>

const globalForDb = globalThis as unknown as {
  client: postgres.Sql | undefined
  db: DrizzleDb | undefined
}

function createDb(): DrizzleDb {
  const url = process.env.POSTGRES_URL
  if (!url) {
    throw new Error('POSTGRES_URL is not set. Configure the database env vars to enable DB features.')
  }

  const requiresSsl = url.includes('sslmode=require') || url.includes('neon.tech')
  // Serverless-tuned. Each Vercel function instance keeps at most ONE
  // connection from the upstream pool (Supabase pgbouncer / Neon) instead
  // of postgres.js's default of 10. With dozens of warm function
  // instances (every wallet poll spins one up), the default behavior
  // demands 100+ concurrent connections from a pool that's hard-capped
  // at the compute-tier limit (Supabase pgbouncer transaction-mode caps
  // ~200 client connections, session-mode caps at the per-tier Pool Size
  // which defaults to 15 on the smaller compute sizes). Verified
  // 2026-05-02: ECHECKOUTTIMEOUT in Transaction mode in production
  // runtime + ECHECKOUTTIMEOUT in Session mode at build/migrate. Per
  // Supabase serverless guidance: `max: 1, prepare: false` for pgbouncer
  // transaction-mode pooling.
  const client = globalForDb.client ?? postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    ...(requiresSsl ? { ssl: 'require' } : {}),
  })
  globalForDb.client = client

  const database = globalForDb.db ?? drizzle(client, { schema })
  globalForDb.db = database

  return database
}

function getDb(): DrizzleDb {
  return globalForDb.db ?? createDb()
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    if (prop === 'then') {
      return undefined
    }
    const database = getDb()
    const value = (database as any)[prop]
    return typeof value === 'function' ? value.bind(database) : value
  },
}) as DrizzleDb
