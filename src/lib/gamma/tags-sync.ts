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

const DEFAULT_PAGE_SIZE = 500
const MAX_PAGE_SIZE = 500
const DEFAULT_MAX_PAGES = 50
const DEFAULT_TIMEOUT_MS = 20_000

export interface TagsSyncResult {
  fetched: number
  inserted: number
  updated: number
  skipped: number
  pagesFetched: number
  lockBusy: boolean
  errors: string[]
}

export interface TagsSyncOptions {
  /** Per-page size, max 500 per Gamma's `/tags` limit. */
  limit?: number
  /** Soft cap on pages per run. Default 50 (~25k tags). */
  maxPages?: number
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
    pagesFetched: 0,
    lockBusy: false,
    errors: [],
  }

  const acquired = await acquireTagsSyncLock()
  if (!acquired) {
    result.lockBusy = true
    return result
  }

  try {
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE)
    const maxPages = options.maxPages && options.maxPages > 0 ? options.maxPages : DEFAULT_MAX_PAGES
    const baseUrl = (options.baseUrl ?? process.env.GAMMA_URL ?? 'https://gamma-api.polymarket.com').replace(/\/$/, '')
    const fetcher = options.fetcher ?? fetch
    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS

    // Polymarket's `/tags` doesn't expose a cursor — pagination is offset-only.
    // Walk pages until either the response is shorter than `limit` (last page)
    // or we hit `maxPages`. Persist each page's mapped tags incrementally so a
    // mid-run failure still upserts the pages we did get.
    let offset = 0
    while (result.pagesFetched < maxPages) {
      const url = `${baseUrl}/tags?limit=${limit}&offset=${offset}&order=updatedAt&ascending=false`
      const page = await fetchTags(url, fetcher, requestTimeoutMs)
      result.pagesFetched += 1

      if (page.length === 0) {
        break
      }

      result.fetched += page.length

      const mapped = mapTags(page)
      if (mapped.length > 0) {
        const upsertResult = await upsertStandaloneTags(mapped)
        result.inserted += upsertResult.inserted
        result.updated += upsertResult.updated
        result.skipped += mapped.length - (upsertResult.inserted + upsertResult.updated)
      }

      if (page.length < limit) {
        break
      }
      offset += limit
    }

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
    return DEFAULT_PAGE_SIZE
  }
  return Math.min(Math.trunc(value), MAX_PAGE_SIZE)
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
