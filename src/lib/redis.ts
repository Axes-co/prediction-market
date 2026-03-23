import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Client (singleton — reused across serverless invocations via module scope)
// ---------------------------------------------------------------------------

let redisInstance: Redis | null = null

/**
 * Returns a shared Redis client. Supports both Upstash standard env vars
 * (`UPSTASH_REDIS_REST_URL`) and Vercel KV env vars (`KV_REST_API_URL`).
 *
 * Returns null if no credentials are configured — callers must handle
 * graceful degradation.
 */
function getRedisClient(): Redis | null {
  if (redisInstance) {
    return redisInstance
  }

  // Prefer standard Upstash env vars, fall back to Vercel KV naming
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    return null
  }

  redisInstance = new Redis({ url, token })
  return redisInstance
}

// ---------------------------------------------------------------------------
// Cache-aside (read-through) helper
// ---------------------------------------------------------------------------

/**
 * Read-through / cache-aside pattern with silent fallback.
 *
 * 1. Try Redis first (~1 ms).
 * 2. On miss → call `fetcher` → store result in Redis with TTL.
 * 3. On Redis failure → silently fall through to `fetcher`.
 *
 * Only successful, non-null results are cached. If the fetcher throws
 * or returns null/undefined, the result is NOT stored — the next caller
 * will retry from the source instead of being served a cached error.
 *
 * The Upstash SDK handles JSON serialization automatically — values
 * are stored and retrieved as their original types without manual
 * JSON.stringify / JSON.parse.
 *
 * The application never fails because of the cache layer.
 *
 * @param key - Redis key for the cached entry.
 * @param fetcher - Async function that produces the data on cache miss.
 * @param ttlSeconds - Time-to-live in seconds for the cached entry.
 * @param shouldCache - Optional predicate to control whether a result
 *   should be cached. Defaults to caching any non-null value. Use this
 *   to skip caching error responses (e.g. `{ data: null, error: '...' }`).
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number,
  shouldCache?: (data: T) => boolean,
): Promise<T> {
  const redis = getRedisClient()

  if (redis) {
    try {
      const cached = await redis.get<T>(key)
      if (cached !== null && cached !== undefined) {
        return cached
      }
    }
    catch {
      // Redis read failed — fall through to fetcher
    }
  }

  const data = await fetcher()

  const isCacheable = data !== null
    && data !== undefined
    && (shouldCache ? shouldCache(data) : true)

  if (redis && isCacheable) {
    try {
      await redis.set(key, data, { ex: ttlSeconds })
    }
    catch {
      // Redis write failed — not critical, data is already returned
    }
  }

  return data
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/**
 * Delete one or more cache keys immediately. Used in write paths
 * (admin settings update, event resolution, etc.) to ensure the
 * next read fetches fresh data from the source.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  const redis = getRedisClient()
  if (!redis || keys.length === 0) {
    return
  }

  try {
    await redis.del(...keys)
  }
  catch {
    // Non-fatal — the key will expire via TTL anyway
  }
}

/**
 * Delete all keys matching a prefix using SCAN (non-blocking).
 * Example: `invalidateCacheByPrefix('data:holders:')` clears all holder caches.
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) {
    return
  }

  try {
    let cursor = 0
    do {
      const [nextCursorRaw, keys] = await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      })
      cursor = typeof nextCursorRaw === 'string'
        ? Number.parseInt(nextCursorRaw, 10)
        : Number(nextCursorRaw)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== 0)
  }
  catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

let publicLimiter: Ratelimit | null = null
let tradingLimiter: Ratelimit | null = null
let authLimiter: Ratelimit | null = null

function createRateLimiter(
  cached: Ratelimit | null,
  config: { limiter: ReturnType<typeof Ratelimit.slidingWindow>, prefix: string },
): Ratelimit | null {
  if (cached) {
    return cached
  }
  const redis = getRedisClient()
  if (!redis) {
    return null
  }
  return new Ratelimit({ redis, analytics: true, ...config })
}

export function getPublicRateLimiter(): Ratelimit | null {
  publicLimiter = createRateLimiter(publicLimiter, {
    limiter: Ratelimit.slidingWindow(100, '10 s'),
    prefix: 'rl:public',
  })
  return publicLimiter
}

export function getTradingRateLimiter(): Ratelimit | null {
  tradingLimiter = createRateLimiter(tradingLimiter, {
    limiter: Ratelimit.tokenBucket(10, '1 s', 10),
    prefix: 'rl:trading',
  })
  return tradingLimiter
}

export function getAuthRateLimiter(): Ratelimit | null {
  authLimiter = createRateLimiter(authLimiter, {
    limiter: Ratelimit.fixedWindow(10, '60 s'),
    prefix: 'rl:auth',
  })
  return authLimiter
}

// ---------------------------------------------------------------------------
// Cache key builders — namespaced to avoid collisions
// ---------------------------------------------------------------------------

export const cacheKeys = {
  // App-level (rarely change)
  settings: 'app:settings',

  // Database queries — public, shared data
  eventList: (hash: string) => `db:events:${hash}`,
  eventBySlug: (slug: string, locale: string) => `db:event:${slug}:${locale}`,
  mainTags: (locale: string) => `db:tags:main:${locale}`,

  // Data API — public, market-level data
  holders: (conditionId: string, limit: number) => `data:holders:${conditionId}:${limit}`,
  trades: (markets: string, offset: number) => `data:trades:${markets}:${offset}`,
  profileStats: (address: string) => `data:profile:${address}`,
  feeReceiverTotals: (address: string, endpoint: string, offset: number) =>
    `data:fees:${address}:${endpoint}:${offset}`,

  // CLOB API — market data
  priceHistory: (tokenId: string, fidelity: number) => `clob:prices:${tokenId}:${fidelity}`,
  orderBookSummary: (conditionId: string) => `clob:orderbook:${conditionId}`,

  // Prefixes for bulk invalidation
  prefix: {
    db: 'db:',
    data: 'data:',
    clob: 'clob:',
    events: 'db:events:',
    event: 'db:event:',
    tags: 'db:tags:',
    holders: 'data:holders:',
    trades: 'data:trades:',
    prices: 'clob:prices:',
  },
} as const

// ---------------------------------------------------------------------------
// Cache TTLs (seconds) — tuned per data type
// ---------------------------------------------------------------------------

export const cacheTTL = {
  // App-level
  settings: 300, // 5 min — admin changes propagate within 5 min

  // Database queries
  eventList: 15, // 15s — most browsed page, tolerable staleness
  eventBySlug: 30, // 30s — individual event page
  mainTags: 300, // 5 min — navigation categories, rarely change

  // Data API
  holders: 30, // 30s — per-market, moderate update frequency
  trades: 10, // 10s — needs freshness, high read volume
  profileStats: 300, // 5 min — portfolio stats, tolerable staleness
  feeReceiverTotals: 300, // 5 min — affiliate fee totals

  // CLOB API
  priceHistory: 60, // 60s — chart data, matches existing ISR
  orderBookSummary: 5, // 5s — orderbook changes frequently
} as const
