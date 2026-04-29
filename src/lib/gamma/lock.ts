import { and, eq, lt, ne, or, sql } from 'drizzle-orm'
import { subgraph_syncs as subgraphSyncs } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

const SERVICE_NAME = 'gamma_sync'
const SOURCE_NAME = 'polymarket'
const STALE_AFTER_MS = 15 * 60 * 1000

const LOCK_FILTER = and(
  eq(subgraphSyncs.service_name, SERVICE_NAME),
  eq(subgraphSyncs.subgraph_name, SOURCE_NAME),
)

export type GammaCursorMap = Record<string, string | null>

export async function acquireGammaSyncLock(): Promise<boolean> {
  await ensureLockRowExists()

  const staleThreshold = new Date(Date.now() - STALE_AFTER_MS)

  const claimed = await db
    .update(subgraphSyncs)
    .set({
      status: 'running',
      error_message: null,
      updated_at: new Date(),
    })
    .where(and(
      LOCK_FILTER,
      or(
        ne(subgraphSyncs.status, 'running'),
        lt(subgraphSyncs.updated_at, staleThreshold),
      ),
    ))
    .returning({ id: subgraphSyncs.id })

  return claimed.length > 0
}

export async function releaseGammaSyncLock(
  finalStatus: 'completed' | 'error',
  options: {
    errorMessage?: string | null
    totalProcessed?: number
    cursors?: GammaCursorMap
  } = {},
): Promise<void> {
  const update: Record<string, unknown> = {
    status: finalStatus,
    updated_at: new Date(),
  }
  if (options.errorMessage !== undefined) {
    update.error_message = options.errorMessage
  }
  if (options.totalProcessed !== undefined) {
    update.total_processed = options.totalProcessed
  }
  if (options.cursors !== undefined) {
    update.cursor_id = serializeCursorMap(options.cursors)
    update.cursor_updated_at = BigInt(Math.floor(Date.now() / 1000))
  }

  await db.update(subgraphSyncs).set(update).where(LOCK_FILTER)
}

export async function loadGammaSyncCursors(): Promise<GammaCursorMap> {
  const rows = await db
    .select({ cursor_id: subgraphSyncs.cursor_id })
    .from(subgraphSyncs)
    .where(LOCK_FILTER)
    .limit(1)

  return parseCursorMap(rows[0]?.cursor_id ?? null)
}

function serializeCursorMap(cursors: GammaCursorMap): string {
  return JSON.stringify(cursors)
}

function parseCursorMap(serialized: string | null): GammaCursorMap {
  if (!serialized) {
    return {}
  }
  try {
    const parsed = JSON.parse(serialized) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: GammaCursorMap = {}
    for (const [sourceUrl, cursor] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof cursor === 'string' || cursor === null) {
        result[sourceUrl] = cursor
      }
    }
    return result
  }
  catch {
    return {}
  }
}

async function ensureLockRowExists(): Promise<void> {
  await db.execute(sql`
    INSERT INTO ${subgraphSyncs} (service_name, subgraph_name, status, total_processed)
    SELECT ${SERVICE_NAME}, ${SOURCE_NAME}, 'idle', 0
    WHERE NOT EXISTS (
      SELECT 1 FROM ${subgraphSyncs}
      WHERE service_name = ${SERVICE_NAME} AND subgraph_name = ${SOURCE_NAME}
    )
  `)
}
