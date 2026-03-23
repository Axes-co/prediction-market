import type { NextResponse } from 'next/server'

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
