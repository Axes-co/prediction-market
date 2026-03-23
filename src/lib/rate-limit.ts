import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthRateLimiter, getPublicRateLimiter, getTradingRateLimiter } from '@/lib/redis'

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

type RateLimitTier = 'public' | 'trading' | 'auth'

const TIER_RESOLVERS: Array<{
  match: (pathname: string) => boolean
  resolve: (method: string) => RateLimitTier | null
}> = [
  {
    match: pathname => pathname.startsWith('/api/auth/'),
    resolve: method => method === 'POST' ? 'auth' : null,
  },
  {
    match: pathname => pathname.startsWith('/api/lifi/'),
    resolve: () => 'trading',
  },
]

// ---------------------------------------------------------------------------
// Tier resolution
// ---------------------------------------------------------------------------

function resolveTier(pathname: string, method: string): RateLimitTier | null {
  if (!pathname.startsWith('/api/')) {
    return null
  }

  for (const { match, resolve } of TIER_RESOLVERS) {
    if (match(pathname)) {
      return resolve(method)
    }
  }

  return 'public'
}

function getLimiter(tier: RateLimitTier) {
  switch (tier) {
    case 'public': return getPublicRateLimiter()
    case 'trading': return getTradingRateLimiter()
    case 'auth': return getAuthRateLimiter()
  }
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

function extractClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'anonymous'
}

/**
 * Apply rate limiting to an API request. Returns a 429 response if the
 * limit is exceeded, or null if the request is allowed.
 *
 * Fails open if Redis is unavailable — the application never breaks
 * because of the rate-limit layer.
 */
export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const tier = resolveTier(request.nextUrl.pathname, request.method)
  if (!tier) {
    return null
  }

  const limiter = getLimiter(tier)
  if (!limiter) {
    return null
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(extractClientIp(request))

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
