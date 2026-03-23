import { NextResponse } from 'next/server'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { withCacheHeaders } from '@/lib/api-utils'

export async function GET(_request: Request) {
  try {
    const locales = await loadEnabledLocales()
    return withCacheHeaders(NextResponse.json({ locales }), 'medium')
  }
  catch (error) {
    console.error('Failed to load locales', error)
    return NextResponse.json({ locales: [] }, { status: 500 })
  }
}
