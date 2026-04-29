import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runGammaSync } from '@/lib/gamma/sync'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const startCursor = url.searchParams.get('cursor')
  const pageSize = parsePositiveInt(url.searchParams.get('limit'))
  const maxPagesPerSource = parsePositiveInt(url.searchParams.get('maxPages'))
  const sourceOverride = url.searchParams.get('source')?.trim()
  const sourceUrls = sourceOverride ? [sourceOverride] : undefined

  try {
    const result = await runGammaSync({
      startCursor,
      pageSize,
      maxPagesPerSource,
      sourceUrls,
    })
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown gamma-sync error'
    console.error('gamma-sync failed:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
