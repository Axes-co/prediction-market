import type { GammaTag } from './types'
import { and, eq, lt, ne, or, sql } from 'drizzle-orm'
import { subgraph_syncs as subgraphSyncs } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { mapTags } from './mapper'
import { upsertStandaloneTags } from './repository'

const TAGS_SYNC_SERVICE_NAME = 'tags_sync'
const TAGS_SYNC_SOURCE_NAME = 'polymarket'
const STALE_AFTER_MS = 15 * 60 * 1000

const TAGS_SYNC_LOCK_FILTER = and(
  eq(subgraphSyncs.service_name, TAGS_SYNC_SERVICE_NAME),
  eq(subgraphSyncs.subgraph_name, TAGS_SYNC_SOURCE_NAME),
)

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 500
const DEFAULT_TIMEOUT_MS = 20_000

export interface TagsSyncResult {
  fetched: number
  inserted: number
  updated: number
  skipped: number
  lockBusy: boolean
  errors: string[]
}

export interface TagsSyncOptions {
  limit?: number
  baseUrl?: string
  fetcher?: typeof fetch
  requestTimeoutMs?: number
}

/**
 * Pulls Polymarket gamma `/tags` directly so we capture pinned tags whose
 * carousel/force-show flags need surfacing even when no current event uses them.
 * The event-embedded `tags` array on `/events/keyset` only includes tags
 * referenced by an event in that page; `/tags` is the authoritative master list.
 */
export async function runTagsSync(options: TagsSyncOptions = {}): Promise<TagsSyncResult> {
  const result: TagsSyncResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    lockBusy: false,
    errors: [],
  }

  const acquired = await acquireTagsSyncLock()
  if (!acquired) {
    result.lockBusy = true
    return result
  }

  try {
    const limit = clampLimit(options.limit ?? DEFAULT_LIMIT)
    const baseUrl = (options.baseUrl ?? process.env.GAMMA_URL ?? 'https://gamma-api.polymarket.com').replace(/\/$/, '')
    const fetcher = options.fetcher ?? fetch
    const url = `${baseUrl}/tags?limit=${limit}&order=updatedAt&ascending=false`

    const tags = await fetchTags(url, fetcher, options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS)
    result.fetched = tags.length

    if (tags.length === 0) {
      await releaseTagsSyncLock('completed', { totalProcessed: 0 })
      return result
    }

    const mapped = mapTags(tags)
    if (mapped.length === 0) {
      await releaseTagsSyncLock('completed', { totalProcessed: 0 })
      return result
    }

    const upsertResult = await upsertStandaloneTags(mapped)
    result.inserted = upsertResult.inserted
    result.updated = upsertResult.updated
    result.skipped = mapped.length - (upsertResult.inserted + upsertResult.updated)

    await releaseTagsSyncLock('completed', {
      totalProcessed: result.fetched,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown tags-sync error'
    result.errors.push(message)
    await releaseTagsSyncLock('error', { errorMessage: message })
  }

  return result
}

async function fetchTags(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<GammaTag[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`gamma tags request failed (${response.status} ${response.statusText})`)
    }

    const payload = await response.json().catch(() => null) as unknown
    if (!Array.isArray(payload)) {
      throw new TypeError('gamma tags response was not an array')
    }
    return payload as GammaTag[]
  }
  finally {
    clearTimeout(timer)
  }
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.trunc(value), MAX_LIMIT)
}

async function acquireTagsSyncLock(): Promise<boolean> {
  await db.execute(sql`
    INSERT INTO ${subgraphSyncs} (service_name, subgraph_name, status, total_processed)
    SELECT ${TAGS_SYNC_SERVICE_NAME}, ${TAGS_SYNC_SOURCE_NAME}, 'idle', 0
    WHERE NOT EXISTS (
      SELECT 1 FROM ${subgraphSyncs}
      WHERE service_name = ${TAGS_SYNC_SERVICE_NAME} AND subgraph_name = ${TAGS_SYNC_SOURCE_NAME}
    )
  `)

  const staleThreshold = new Date(Date.now() - STALE_AFTER_MS)
  const claimed = await db
    .update(subgraphSyncs)
    .set({
      status: 'running',
      error_message: null,
      updated_at: new Date(),
    })
    .where(and(
      TAGS_SYNC_LOCK_FILTER,
      or(
        ne(subgraphSyncs.status, 'running'),
        lt(subgraphSyncs.updated_at, staleThreshold),
      ),
    ))
    .returning({ id: subgraphSyncs.id })

  return claimed.length > 0
}

async function releaseTagsSyncLock(
  finalStatus: 'completed' | 'error',
  options: { errorMessage?: string | null, totalProcessed?: number } = {},
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
  await db.update(subgraphSyncs).set(update).where(TAGS_SYNC_LOCK_FILTER)
}
