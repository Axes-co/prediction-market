import { eq, inArray } from 'drizzle-orm'
import { buildDataApiUrl } from '@/lib/data-api/client'
import {
  events as eventsTable,
  markets as marketsTable,
  polymarket_users as polymarketUsersTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { withCache } from '@/lib/redis'

const HOLDERS_PER_MARKET_LIMIT = 200
const ALLOWLIST_TTL_SECONDS = 30
const FETCH_CONCURRENCY = 4

interface DataApiHolder {
  proxyWallet?: string | null
}
interface DataApiHoldersBucket {
  token: string
  holders: DataApiHolder[]
}

async function fetchHoldersForMarket(conditionId: string): Promise<string[]> {
  const params = new URLSearchParams({
    market: conditionId,
    limit: String(HOLDERS_PER_MARKET_LIMIT),
  })
  try {
    const response = await fetch(buildDataApiUrl('/holders', params), {
      // Server-side fetch; bypass Next data cache so this is a live read of
      // the data-api per allowlist refresh window.
      cache: 'no-store',
    })
    if (!response.ok) {
      return []
    }
    const payload = await response.json() as DataApiHoldersBucket[]
    if (!Array.isArray(payload)) {
      return []
    }
    const out: string[] = []
    for (const bucket of payload) {
      if (!Array.isArray(bucket?.holders)) {
        continue
      }
      for (const holder of bucket.holders) {
        const proxy = typeof holder?.proxyWallet === 'string' ? holder.proxyWallet.trim().toLowerCase() : ''
        if (/^0x[a-f0-9]{40}$/.test(proxy)) {
          out.push(proxy)
        }
      }
    }
    return out
  }
  catch {
    return []
  }
}

async function resolveProxyWalletsToBaseAddresses(proxyWallets: string[]): Promise<string[]> {
  if (proxyWallets.length === 0) {
    return []
  }
  const rows = await db
    .select({ base_address: polymarketUsersTable.base_address })
    .from(polymarketUsersTable)
    .where(inArray(polymarketUsersTable.proxy_wallet, proxyWallets))

  return rows.map(r => r.base_address)
}

async function fetchInBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R[]>,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = []
  let cursor = 0
  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++
      const result = await worker(items[idx])
      out.push(...result)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => pump())
  await Promise.all(workers)
  return out
}

/**
 * Build the allowlist of `polymarket_users.base_address` values for users who
 * currently hold a position in any of the event's markets. Powers
 * `holders_only=true` on the comments list.
 *
 * Returns null when the event has no resolvable markets — caller should treat
 * null as "filter not applicable" rather than "empty result", because filtering
 * to an empty set would always return zero comments and feels broken.
 *
 * Cached per-event for `ALLOWLIST_TTL_SECONDS` to keep `/api/comments?holders_only=true`
 * cheap; the Polymarket data-api `/holders` endpoint we proxy here has its own
 * 30s TTL so this matches.
 */
export async function getEventHoldersAllowlist(eventSlug: string): Promise<Set<string> | null> {
  const cacheKey = `comments:holders_allowlist:${eventSlug}`
  const cached = await withCache(
    cacheKey,
    async () => {
      const conditionRows = await db
        .select({ condition_id: marketsTable.condition_id })
        .from(marketsTable)
        .innerJoin(eventsTable, eq(eventsTable.id, marketsTable.event_id))
        .where(eq(eventsTable.slug, eventSlug))
      const conditionIds = conditionRows
        .map(r => r.condition_id)
        .filter((c): c is string => typeof c === 'string' && c.length > 0)
      if (conditionIds.length === 0) {
        return { addresses: [] as string[], hasMarkets: false }
      }

      const proxyWallets = await fetchInBatches(conditionIds, fetchHoldersForMarket, FETCH_CONCURRENCY)
      const uniqueProxies = [...new Set(proxyWallets)]
      const baseAddresses = await resolveProxyWalletsToBaseAddresses(uniqueProxies)
      return { addresses: baseAddresses, hasMarkets: true }
    },
    ALLOWLIST_TTL_SECONDS,
  )

  if (!cached.hasMarkets) {
    return null
  }
  return new Set(cached.addresses)
}

/**
 * Variant for tests that need to skip the cache entirely.
 */
export async function _getEventHoldersAllowlistUncached(eventSlug: string): Promise<Set<string> | null> {
  const conditionRows = await db
    .select({ condition_id: marketsTable.condition_id })
    .from(marketsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, marketsTable.event_id))
    .where(eq(eventsTable.slug, eventSlug))
  const conditionIds = conditionRows
    .map(r => r.condition_id)
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
  if (conditionIds.length === 0) {
    return null
  }
  const proxyWallets = await fetchInBatches(conditionIds, fetchHoldersForMarket, FETCH_CONCURRENCY)
  const uniqueProxies = [...new Set(proxyWallets)]
  const baseAddresses = await resolveProxyWalletsToBaseAddresses(uniqueProxies)
  return new Set(baseAddresses)
}
