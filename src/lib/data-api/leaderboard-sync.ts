import { sql } from 'drizzle-orm'
import { getDataApiUrl } from '@/lib/data-api/client'
import { polymarket_traders as polymarketTradersTable } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

type TimePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'ALL'
type OrderBy = 'PNL' | 'VOL'

interface LeaderboardEntry {
  rank?: string
  proxyWallet?: string
  userName?: string
  vol?: number
  pnl?: number
  profileImage?: string
  xUsername?: string
  verifiedBadge?: boolean
}

const PAGE_LIMIT = 50
const MAX_OFFSET = 1000

/**
 * Per-row aggregate built up across the leaderboard fetches. Each pass over
 * `(timePeriod, orderBy)` updates a subset of fields on the same row.
 */
interface TraderUpdate {
  proxy_wallet: string
  user_name: string | null
  profile_image: string | null
  x_username: string | null
  verified_badge: boolean | null
  pnl_all: number | null
  vol_all: number | null
  pnl_month: number | null
  vol_month: number | null
  pnl_week: number | null
  vol_week: number | null
  pnl_day: number | null
  vol_day: number | null
  rank_pnl_all: number | null
  rank_vol_all: number | null
}

function emptyUpdate(proxyWallet: string): TraderUpdate {
  return {
    proxy_wallet: proxyWallet,
    user_name: null,
    profile_image: null,
    x_username: null,
    verified_badge: null,
    pnl_all: null,
    vol_all: null,
    pnl_month: null,
    vol_month: null,
    pnl_week: null,
    vol_week: null,
    pnl_day: null,
    vol_day: null,
    rank_pnl_all: null,
    rank_vol_all: null,
  }
}

function isValidProxy(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-f0-9]{40}$/i.test(value)
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toRank(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function fetchLeaderboardPage(args: {
  baseUrl: string
  timePeriod: TimePeriod
  orderBy: OrderBy
  limit: number
  offset: number
  signal?: AbortSignal
}): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    category: 'OVERALL',
    timePeriod: args.timePeriod,
    orderBy: args.orderBy,
    limit: String(args.limit),
    offset: String(args.offset),
  })
  const url = `${args.baseUrl}/v1/leaderboard?${params.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: args.signal,
  })

  if (!response.ok) {
    throw new Error(`leaderboard ${args.timePeriod}/${args.orderBy} request failed (${response.status})`)
  }

  const payload = await response.json().catch(() => null) as unknown
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.filter((entry): entry is LeaderboardEntry => Boolean(entry) && typeof entry === 'object')
}

interface LeaderboardSyncOptions {
  /** Hard cap on traders fetched per (timePeriod, orderBy) pass. Defaults to 500. */
  topN?: number
  /** Optional time budget. Defaults to 250s (Vercel cron max - 50s headroom). */
  timeLimitMs?: number
  /** Override the Data API base URL. Defaults to `getDataApiUrl()`. */
  baseUrl?: string
}

export interface LeaderboardSyncResult {
  passes: number
  tradersTouched: number
  inserts: number
  updates: number
  errors: Array<{ pass: string, message: string }>
  timeLimitReached: boolean
}

const DEFAULT_TIME_LIMIT_MS = 250_000
const DEFAULT_TOP_N = 500

const PASSES: Array<{ timePeriod: TimePeriod, orderBy: OrderBy }> = [
  { timePeriod: 'ALL', orderBy: 'PNL' },
  { timePeriod: 'ALL', orderBy: 'VOL' },
  { timePeriod: 'MONTH', orderBy: 'PNL' },
  { timePeriod: 'MONTH', orderBy: 'VOL' },
  { timePeriod: 'WEEK', orderBy: 'PNL' },
  { timePeriod: 'WEEK', orderBy: 'VOL' },
  { timePeriod: 'DAY', orderBy: 'PNL' },
  { timePeriod: 'DAY', orderBy: 'VOL' },
]

function applyEntryToUpdate(
  update: TraderUpdate,
  entry: LeaderboardEntry,
  pass: { timePeriod: TimePeriod, orderBy: OrderBy },
): void {
  // Profile metadata is duplicated across all passes; keep the first non-null
  // value rather than overwriting on every pass.
  if (update.user_name === null && typeof entry.userName === 'string') {
    update.user_name = entry.userName
  }
  if (update.profile_image === null && typeof entry.profileImage === 'string') {
    update.profile_image = entry.profileImage
  }
  if (update.x_username === null && typeof entry.xUsername === 'string') {
    update.x_username = entry.xUsername
  }
  if (update.verified_badge === null && typeof entry.verifiedBadge === 'boolean') {
    update.verified_badge = entry.verifiedBadge
  }

  const pnl = toFiniteNumber(entry.pnl)
  const vol = toFiniteNumber(entry.vol)
  const rank = toRank(entry.rank)

  switch (pass.timePeriod) {
    case 'ALL':
      update.pnl_all = pnl
      update.vol_all = vol
      if (pass.orderBy === 'PNL') {
        update.rank_pnl_all = rank
      }
      else {
        update.rank_vol_all = rank
      }
      break
    case 'MONTH':
      update.pnl_month = pnl
      update.vol_month = vol
      break
    case 'WEEK':
      update.pnl_week = pnl
      update.vol_week = vol
      break
    case 'DAY':
      update.pnl_day = pnl
      update.vol_day = vol
      break
  }
}

async function persistTraders(updates: Map<string, TraderUpdate>): Promise<{ inserts: number, updates: number }> {
  const rows = Array.from(updates.values())
  if (rows.length === 0) {
    return { inserts: 0, updates: 0 }
  }

  // Batch in chunks to keep the parameter count under the postgres limit
  // (8 fields * 500 rows == well under 65k params, so 500 per batch is fine).
  const BATCH_SIZE = 500
  let inserts = 0
  let updates_count = 0

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE)
    const values = batch.map(row => ({
      proxy_wallet: row.proxy_wallet,
      user_name: row.user_name,
      profile_image: row.profile_image,
      x_username: row.x_username,
      verified_badge: row.verified_badge,
      pnl_all: row.pnl_all !== null ? String(row.pnl_all) : null,
      vol_all: row.vol_all !== null ? String(row.vol_all) : null,
      pnl_month: row.pnl_month !== null ? String(row.pnl_month) : null,
      vol_month: row.vol_month !== null ? String(row.vol_month) : null,
      pnl_week: row.pnl_week !== null ? String(row.pnl_week) : null,
      vol_week: row.vol_week !== null ? String(row.vol_week) : null,
      pnl_day: row.pnl_day !== null ? String(row.pnl_day) : null,
      vol_day: row.vol_day !== null ? String(row.vol_day) : null,
      rank_pnl_all: row.rank_pnl_all,
      rank_vol_all: row.rank_vol_all,
      source: 'leaderboard',
    }))

    const written = await db
      .insert(polymarketTradersTable)
      .values(values)
      .onConflictDoUpdate({
        target: polymarketTradersTable.proxy_wallet,
        set: {
          user_name: sql`COALESCE(EXCLUDED.user_name, ${polymarketTradersTable.user_name})`,
          profile_image: sql`COALESCE(EXCLUDED.profile_image, ${polymarketTradersTable.profile_image})`,
          x_username: sql`COALESCE(EXCLUDED.x_username, ${polymarketTradersTable.x_username})`,
          verified_badge: sql`COALESCE(EXCLUDED.verified_badge, ${polymarketTradersTable.verified_badge})`,
          pnl_all: sql`COALESCE(EXCLUDED.pnl_all, ${polymarketTradersTable.pnl_all})`,
          vol_all: sql`COALESCE(EXCLUDED.vol_all, ${polymarketTradersTable.vol_all})`,
          pnl_month: sql`COALESCE(EXCLUDED.pnl_month, ${polymarketTradersTable.pnl_month})`,
          vol_month: sql`COALESCE(EXCLUDED.vol_month, ${polymarketTradersTable.vol_month})`,
          pnl_week: sql`COALESCE(EXCLUDED.pnl_week, ${polymarketTradersTable.pnl_week})`,
          vol_week: sql`COALESCE(EXCLUDED.vol_week, ${polymarketTradersTable.vol_week})`,
          pnl_day: sql`COALESCE(EXCLUDED.pnl_day, ${polymarketTradersTable.pnl_day})`,
          vol_day: sql`COALESCE(EXCLUDED.vol_day, ${polymarketTradersTable.vol_day})`,
          rank_pnl_all: sql`COALESCE(EXCLUDED.rank_pnl_all, ${polymarketTradersTable.rank_pnl_all})`,
          rank_vol_all: sql`COALESCE(EXCLUDED.rank_vol_all, ${polymarketTradersTable.rank_vol_all})`,
          last_seen_at: sql`NOW()`,
          source: sql`EXCLUDED.source`,
        },
      })
      .returning({ first_seen_at: polymarketTradersTable.first_seen_at, last_seen_at: polymarketTradersTable.last_seen_at })

    for (const row of written) {
      if (row.first_seen_at.getTime() === row.last_seen_at.getTime()) {
        inserts += 1
      }
      else {
        updates_count += 1
      }
    }
  }

  return { inserts, updates: updates_count }
}

export async function runLeaderboardSync(options: LeaderboardSyncOptions = {}): Promise<LeaderboardSyncResult> {
  const startedAt = Date.now()
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS
  const topN = options.topN ?? DEFAULT_TOP_N
  const baseUrl = options.baseUrl ?? getDataApiUrl()

  const result: LeaderboardSyncResult = {
    passes: 0,
    tradersTouched: 0,
    inserts: 0,
    updates: 0,
    errors: [],
    timeLimitReached: false,
  }

  const updates = new Map<string, TraderUpdate>()

  for (const pass of PASSES) {
    if (Date.now() - startedAt > timeLimitMs) {
      result.timeLimitReached = true
      break
    }

    let offset = 0
    while (offset < Math.min(topN, MAX_OFFSET + PAGE_LIMIT)) {
      if (Date.now() - startedAt > timeLimitMs) {
        result.timeLimitReached = true
        break
      }

      const limit = Math.min(PAGE_LIMIT, topN - offset)
      if (limit <= 0) {
        break
      }

      let entries: LeaderboardEntry[]
      try {
        entries = await fetchLeaderboardPage({
          baseUrl,
          timePeriod: pass.timePeriod,
          orderBy: pass.orderBy,
          limit,
          offset,
        })
      }
      catch (error) {
        result.errors.push({
          pass: `${pass.timePeriod}/${pass.orderBy}@${offset}`,
          message: error instanceof Error ? error.message : 'unknown leaderboard fetch error',
        })
        break
      }

      if (entries.length === 0) {
        break
      }

      for (const entry of entries) {
        const proxy = entry.proxyWallet?.toLowerCase()
        if (!isValidProxy(proxy)) {
          continue
        }
        const update = updates.get(proxy) ?? emptyUpdate(proxy)
        applyEntryToUpdate(update, entry, pass)
        updates.set(proxy, update)
      }

      if (entries.length < limit) {
        break
      }
      offset += limit
    }

    result.passes += 1
  }

  if (updates.size > 0) {
    try {
      const written = await persistTraders(updates)
      result.inserts = written.inserts
      result.updates = written.updates
      result.tradersTouched = updates.size
    }
    catch (error) {
      result.errors.push({
        pass: 'persist',
        message: error instanceof Error ? error.message : 'unknown persist error',
      })
    }
  }

  return result
}
