import type { PolymarketComment, PolymarketCommentProfile } from '@/lib/comments/polymarket-adapter'
import { and, eq, isNotNull, lt, ne, or, sql } from 'drizzle-orm'
import {
  comments as commentsTable,
  events as eventsTable,
  polymarket_users as polymarketUsersTable,
  subgraph_syncs as subgraphSyncs,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

const COMMENTS_SYNC_SERVICE_NAME = 'gamma_comments_sync'
const COMMENTS_SYNC_SOURCE_NAME = 'polymarket'
const STALE_AFTER_MS = 15 * 60 * 1000

const DEFAULT_LIMIT_PER_EVENT = 50
const DEFAULT_MAX_EVENTS_PER_RUN = 25
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
const ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/

const COMMENTS_SYNC_LOCK_FILTER = and(
  eq(subgraphSyncs.service_name, COMMENTS_SYNC_SERVICE_NAME),
  eq(subgraphSyncs.subgraph_name, COMMENTS_SYNC_SOURCE_NAME),
)

export interface CommentsSyncOptions {
  limitPerEvent?: number
  maxEventsPerRun?: number
  baseUrl?: string
  fetcher?: typeof fetch
  requestTimeoutMs?: number
}

export interface CommentsSyncResult {
  eventsConsidered: number
  eventsScanned: number
  commentsFetched: number
  commentsInserted: number
  commentsSkipped: number
  usersUpserted: number
  errors: string[]
  lockBusy: boolean
}

/**
 * Pull gamma comments for events we already track and seed them into the
 * native `comments` table. The cron is opportunistic: each run picks the
 * least-recently-touched events with a `gamma_event_id`, fetches their newest
 * comments, dedupes against the unique (external_source, external_id) index,
 * and upserts each commenter into `polymarket_users`.
 *
 * Native comments authored through Axes (`external_source = 'native'`) are
 * left untouched by this sync — they live alongside seeded ones.
 */
export async function runCommentsSync(options: CommentsSyncOptions = {}): Promise<CommentsSyncResult> {
  const result: CommentsSyncResult = {
    eventsConsidered: 0,
    eventsScanned: 0,
    commentsFetched: 0,
    commentsInserted: 0,
    commentsSkipped: 0,
    usersUpserted: 0,
    errors: [],
    lockBusy: false,
  }

  const acquired = await acquireCommentsSyncLock()
  if (!acquired) {
    result.lockBusy = true
    return result
  }

  try {
    const limitPerEvent = clampInt(options.limitPerEvent ?? DEFAULT_LIMIT_PER_EVENT, 1, 200)
    const maxEventsPerRun = clampInt(options.maxEventsPerRun ?? DEFAULT_MAX_EVENTS_PER_RUN, 1, 100)
    const baseUrl = (options.baseUrl ?? process.env.GAMMA_URL ?? 'https://gamma-api.polymarket.com').replace(/\/$/, '')
    const fetcher = options.fetcher ?? fetch
    const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

    const eventsToScan = await db
      .select({ id: eventsTable.id, gamma_event_id: eventsTable.gamma_event_id })
      .from(eventsTable)
      .where(isNotNull(eventsTable.gamma_event_id))
      .orderBy(eventsTable.updated_at)
      .limit(maxEventsPerRun)

    result.eventsConsidered = eventsToScan.length

    for (const eventRow of eventsToScan) {
      if (typeof eventRow.gamma_event_id !== 'number') {
        continue
      }
      result.eventsScanned += 1
      try {
        const fetched = await fetchGammaComments(
          baseUrl,
          eventRow.gamma_event_id,
          limitPerEvent,
          fetcher,
          timeoutMs,
        )
        result.commentsFetched += fetched.length

        for (const comment of fetched) {
          const seedResult = await seedComment(eventRow.id, comment)
          if (seedResult.userTouched) {
            result.usersUpserted += 1
          }
          if (seedResult.inserted) {
            result.commentsInserted += 1
          }
          else {
            result.commentsSkipped += 1
          }
        }

        await refreshEventCommentCount(eventRow.id)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        result.errors.push(`event ${eventRow.gamma_event_id}: ${message}`)
      }
    }

    await releaseCommentsSyncLock('completed', { totalProcessed: result.commentsInserted })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown comments-sync error'
    result.errors.push(message)
    await releaseCommentsSyncLock('error', { errorMessage: message })
  }

  return result
}

interface SeedResult {
  inserted: boolean
  userTouched: boolean
}

async function seedComment(eventId: string, raw: PolymarketComment): Promise<SeedResult> {
  if (!raw?.id) {
    return { inserted: false, userTouched: false }
  }
  const body = (raw.body ?? '').trim()
  if (body.length === 0 || body.length > 2000) {
    return { inserted: false, userTouched: false }
  }
  const baseAddress = normalizeAddress(raw.profile?.baseAddress) ?? normalizeAddress(raw.userAddress)
  if (!baseAddress) {
    return { inserted: false, userTouched: false }
  }

  // 1. Mirror the commenter as a polymarket_user row first so the FK on
  // `comments.author_base_address` is satisfiable.
  await upsertPolymarketUser(baseAddress, raw.profile)

  // 2. Insert the comment if we haven't already seeded this gamma id.
  const inserted = await db
    .insert(commentsTable)
    .values({
      event_id: eventId,
      author_base_address: baseAddress,
      body: body.slice(0, 2000),
      reactions_count: typeof raw.reactionCount === 'number' && raw.reactionCount >= 0 ? raw.reactionCount : 0,
      reports_count: typeof raw.reportCount === 'number' && raw.reportCount >= 0 ? raw.reportCount : 0,
      external_source: 'gamma_seed',
      external_id: raw.id,
      created_at: parseDate(raw.createdAt) ?? new Date(),
      updated_at: parseDate(raw.updatedAt ?? raw.createdAt) ?? new Date(),
    })
    .onConflictDoNothing({ target: [commentsTable.external_source, commentsTable.external_id] })
    .returning({ id: commentsTable.id })

  return {
    inserted: inserted.length > 0,
    userTouched: true,
  }
}

async function upsertPolymarketUser(
  baseAddress: string,
  profile: PolymarketCommentProfile | null | undefined,
): Promise<void> {
  await db
    .insert(polymarketUsersTable)
    .values({
      base_address: baseAddress,
      proxy_wallet: normalizeAddress(profile?.proxyWallet),
      pseudonym: trim(profile?.pseudonym, 80),
      name: trim(profile?.name, 80),
      display_username_public: typeof profile?.displayUsernamePublic === 'boolean' ? profile.displayUsernamePublic : null,
      bio: trim(profile?.bio, 1000),
      profile_image: trim(profile?.profileImage, 1000),
      profile_image_optimized: trim(profile?.profileImageOptimized, 1000),
      source: 'comments',
    })
    .onConflictDoUpdate({
      target: polymarketUsersTable.base_address,
      set: {
        proxy_wallet: sql`COALESCE(${polymarketUsersTable.proxy_wallet}, EXCLUDED.proxy_wallet)`,
        pseudonym: sql`COALESCE(EXCLUDED.pseudonym, ${polymarketUsersTable.pseudonym})`,
        name: sql`COALESCE(EXCLUDED.name, ${polymarketUsersTable.name})`,
        display_username_public: sql`COALESCE(EXCLUDED.display_username_public, ${polymarketUsersTable.display_username_public})`,
        bio: sql`COALESCE(EXCLUDED.bio, ${polymarketUsersTable.bio})`,
        profile_image: sql`COALESCE(EXCLUDED.profile_image, ${polymarketUsersTable.profile_image})`,
        profile_image_optimized: sql`COALESCE(EXCLUDED.profile_image_optimized, ${polymarketUsersTable.profile_image_optimized})`,
        last_seen_at: sql`NOW()`,
        source: sql`EXCLUDED.source`,
      },
    })
}

async function refreshEventCommentCount(eventId: string): Promise<void> {
  await db
    .update(eventsTable)
    .set({
      comment_count: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${commentsTable}
        WHERE ${commentsTable.event_id} = ${eventsTable.id}
          AND ${commentsTable.is_hidden} = FALSE
      )`,
      updated_at: new Date(),
    })
    .where(eq(eventsTable.id, eventId))
}

async function fetchGammaComments(
  baseUrl: string,
  gammaEventId: number,
  limit: number,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<PolymarketComment[]> {
  const url = new URL(`${baseUrl}/comments`)
  url.searchParams.set('parent_entity_type', 'Event')
  url.searchParams.set('parent_entity_id', String(gammaEventId))
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('order', 'createdAt')
  url.searchParams.set('ascending', 'false')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`gamma comments request failed (${response.status})`)
    }
    const payload = await response.json().catch(() => null) as unknown
    return Array.isArray(payload) ? (payload as PolymarketComment[]) : []
  }
  finally {
    clearTimeout(timer)
  }
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  return ADDRESS_PATTERN.test(trimmed) ? trimmed : null
}

function trim(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function parseDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || !value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(Math.max(Math.trunc(value), min), max)
}

async function acquireCommentsSyncLock(): Promise<boolean> {
  await db.execute(sql`
    INSERT INTO ${subgraphSyncs} (service_name, subgraph_name, status, total_processed)
    SELECT ${COMMENTS_SYNC_SERVICE_NAME}, ${COMMENTS_SYNC_SOURCE_NAME}, 'idle', 0
    WHERE NOT EXISTS (
      SELECT 1 FROM ${subgraphSyncs}
      WHERE service_name = ${COMMENTS_SYNC_SERVICE_NAME} AND subgraph_name = ${COMMENTS_SYNC_SOURCE_NAME}
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
      COMMENTS_SYNC_LOCK_FILTER,
      or(
        ne(subgraphSyncs.status, 'running'),
        lt(subgraphSyncs.updated_at, staleThreshold),
      ),
    ))
    .returning({ id: subgraphSyncs.id })

  return claimed.length > 0
}

async function releaseCommentsSyncLock(
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
  await db.update(subgraphSyncs).set(update).where(COMMENTS_SYNC_LOCK_FILTER)
}
