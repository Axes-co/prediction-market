import { NextResponse } from 'next/server'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { checkRateLimit, withCacheHeaders } from '@/lib/api-utils'

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) {
    return rateLimited
  }

  try {
    const locales = await loadEnabledLocales()
    return withCacheHeaders(NextResponse.json({ locales }), 'medium')
  }
  catch (error) {
    console.error('Failed to load locales', error)
    return NextResponse.json({ locales: [] }, { status: 500 })
  }
}
