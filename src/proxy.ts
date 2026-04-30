import type { NextRequest } from 'next/server'
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation'
import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getRequestCountryCode,
  isCountryBlocked,
  loadBlockedCountries,
} from '@/lib/geoblock-settings'
import {
  buildPredictionResultsInternalRoutePath,
  hasPredictionResultsFilterSearchParams,
  PREDICTION_RESULTS_SORT_PARAM,
  PREDICTION_RESULTS_STATUS_PARAM,
  resolvePredictionResultsFiltersFromSearchParams,
} from '@/lib/prediction-results-filters'
import { applyRateLimit } from '@/lib/rate-limit'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)
const protectedPrefixes = ['/settings', '/portfolio', '/admin']
const DEFAULT_PREDICTIONS_ROUTE_SLUG = 'trending'

const BLOCKED_COUNTRIES_CACHE_TTL_MS = 60_000
let blockedCountriesCache: { value: string[], expiresAt: number } | null = null

async function getBlockedCountriesCached(): Promise<string[]> {
  const now = Date.now()
  if (blockedCountriesCache && blockedCountriesCache.expiresAt > now) {
    return blockedCountriesCache.value
  }
  const value = await loadBlockedCountries()
  blockedCountriesCache = { value, expiresAt: now + BLOCKED_COUNTRIES_CACHE_TTL_MS }
  return value
}

const GEOBLOCK_API_ALLOWED_PATHS = new Set([
  '/api/geoblock-status',
  '/api/auth',
])

function isGeoblockedApiPath(pathname: string, method: string) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return false
  }
  for (const allowed of GEOBLOCK_API_ALLOWED_PATHS) {
    if (pathname === allowed || pathname.startsWith(`${allowed}/`)) {
      return false
    }
  }
  return true
}
type Locale = (typeof routing.locales)[number]
const { rewrite: rewriteMarkdownExtensionWithLocale } = rewritePath(
  '/:locale/docs{/*path}.mdx',
  '/:locale/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownExtensionDefaultLocale } = rewritePath(
  '/docs{/*path}.mdx',
  '/en/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownWithLocale } = rewritePath(
  '/:locale/docs{/*path}',
  '/:locale/llms.mdx/docs{/*path}',
)
const { rewrite: rewriteMarkdownDefaultLocale } = rewritePath(
  '/docs{/*path}',
  '/en/llms.mdx/docs{/*path}',
)

function getLocaleFromPathname(pathname: string): Locale | null {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return null
}

function resolveRequestLocale(pathnameLocale: Locale | null): Locale {
  return pathnameLocale ?? routing.defaultLocale
}

function stripLocale(pathname: string, locale: Locale | null) {
  if (!locale) {
    return pathname
  }
  const withoutLocale = pathname.slice(locale.length + 1)
  return withoutLocale.startsWith('/') ? withoutLocale : '/'
}

function withLocale(pathname: string, locale: Locale | null) {
  if (!locale || locale === routing.defaultLocale) {
    return pathname
  }
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
}

function withExplicitLocale(pathname: string, locale: Locale) {
  return pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
}

function resolvePredictionResultsRewrite({
  pathname,
  searchParams,
}: {
  pathname: string
  searchParams: URLSearchParams
}) {
  if (!hasPredictionResultsFilterSearchParams(searchParams)) {
    return null
  }

  const normalizedPathname = pathname === '/predictions'
    ? `/predictions/${DEFAULT_PREDICTIONS_ROUTE_SLUG}`
    : pathname

  if (!/^\/predictions\/[^/]+$/.test(normalizedPathname)) {
    return null
  }

  const filters = resolvePredictionResultsFiltersFromSearchParams(searchParams)
  const rewrittenSearchParams = new URLSearchParams(searchParams.toString())

  rewrittenSearchParams.delete(PREDICTION_RESULTS_SORT_PARAM)
  rewrittenSearchParams.delete(PREDICTION_RESULTS_STATUS_PARAM)

  return {
    pathname: buildPredictionResultsInternalRoutePath(normalizedPathname, filters),
    search: rewrittenSearchParams.toString(),
  }
}

export default async function proxy(request: NextRequest) {
  const url = new URL(request.url)

  if (url.pathname === '/geoblock' || /^\/[a-z]{2}\/geoblock$/.test(url.pathname)) {
    return NextResponse.next()
  }

  const country = getRequestCountryCode(request.headers)
  const blockedCountries = await getBlockedCountriesCached()
  const isBlocked = isCountryBlocked(country, blockedCountries)

  if (isBlocked && url.pathname.startsWith('/api/')) {
    if (isGeoblockedApiPath(url.pathname, request.method)) {
      return NextResponse.json(
        { error: 'restricted_region', country },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }
  }

  if (url.pathname.startsWith('/api/')) {
    const rateLimited = await applyRateLimit(request)
    if (rateLimited) {
      return rateLimited
    }
    return NextResponse.next()
  }

  if (isBlocked) {
    const pathnameLocale = getLocaleFromPathname(url.pathname)
    const locale = resolveRequestLocale(pathnameLocale)
    return NextResponse.redirect(new URL(withLocale('/geoblock', locale), request.url))
  }

  const markdownPath = rewriteMarkdownExtensionWithLocale(url.pathname) || rewriteMarkdownExtensionDefaultLocale(url.pathname)

  if (markdownPath) {
    const rewrittenUrl = new URL(markdownPath, request.url)
    rewrittenUrl.search = url.search
    return NextResponse.rewrite(rewrittenUrl)
  }

  if (isMarkdownPreferred(request)) {
    const rewrittenPath = rewriteMarkdownWithLocale(url.pathname) || rewriteMarkdownDefaultLocale(url.pathname)
    if (rewrittenPath) {
      const rewrittenUrl = new URL(rewrittenPath, request.url)
      rewrittenUrl.search = url.search
      return NextResponse.rewrite(rewrittenUrl)
    }
  }

  const pathnameLocale = getLocaleFromPathname(url.pathname)
  const pathname = stripLocale(url.pathname, pathnameLocale)
  const locale = resolveRequestLocale(pathnameLocale)
  const predictionResultsRewrite = resolvePredictionResultsRewrite({
    pathname,
    searchParams: url.searchParams,
  })

  if (predictionResultsRewrite) {
    const rewrittenUrl = new URL(withExplicitLocale(predictionResultsRewrite.pathname, locale), request.url)
    rewrittenUrl.search = predictionResultsRewrite.search
    return NextResponse.rewrite(rewrittenUrl)
  }

  const isProtected = protectedPrefixes.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (!isProtected) {
    return intlMiddleware(request)
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.redirect(new URL(withLocale('/', locale), request.url))
  }

  if (pathname.startsWith('/admin')) {
    if (!session.user?.is_admin) {
      return NextResponse.redirect(new URL(withLocale('/', locale), request.url))
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|trpc|_next|_vercel|embed|.*\\..*).*)',
    '/docs.mdx',
    '/docs/:path*.mdx',
    '/:locale/docs.mdx',
    '/:locale/docs/:path*.mdx',
  ],
}
