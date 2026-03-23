import { NextResponse } from 'next/server'
import { getAuthRateLimiter, getPublicRateLimiter, getTradingRateLimiter } from '@/lib/redis'

// ---------------------------------------------------------------------------
// Cache-Control presets for API routes
// ---------------------------------------------------------------------------

export const cacheControl = {
  /** Public data that changes every few seconds (trades, prices) */
  realtime: 'public, s-maxage=5, stale-while-revalidate=10',
  /** Public data that tolerates short staleness (holders, events) */
  short: 'public, s-maxage=15, stale-while-revalidate=30',
  /** Semi-static data (settings, locales, affiliate config) */
  medium: 'public, max-age=300, stale-while-revalidate=60',
  /** Static data (embed metadata) */
  long: 'public, max-age=3600, stale-while-revalidate=600',
  /** Never cache (user-specific, mutations) */
  none: 'no-store',
} as const

export type CachePreset = keyof typeof cacheControl

/**
 * Apply Cache-Control header to a NextResponse.
 */
export function withCacheHeaders(response: NextResponse, preset: CachePreset): NextResponse {
  response.headers.set('Cache-Control', cacheControl[preset])
  return response
}

// ---------------------------------------------------------------------------
// Rate limiting for API routes
// ---------------------------------------------------------------------------

type RateLimitTier = 'public' | 'trading' | 'auth'

function getLimiterForTier(tier: RateLimitTier) {
  switch (tier) {
    case 'public': return getPublicRateLimiter()
    case 'trading': return getTradingRateLimiter()
    case 'auth': return getAuthRateLimiter()
  }
}

/**
 * Check rate limit for an API request. Returns a 429 response if the
 * limit is exceeded, or null if the request is allowed.
 *
 * Extracts the client IP from standard headers. Falls back to allowing
 * the request if Redis is unavailable (fail-open).
 */
export async function checkRateLimit(
  request: Request,
  tier: RateLimitTier = 'public',
): Promise<NextResponse | null> {
  const limiter = getLimiterForTier(tier)
  if (!limiter) {
    return null
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'anonymous'

  try {
    const { success, limit, remaining, reset } = await limiter.limit(ip)

    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        },
      )
    }
  }
  catch {
    // Redis failure — fail open, allow the request
  }

  return null
}
