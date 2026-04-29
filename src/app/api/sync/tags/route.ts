import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runTagsSync } from '@/lib/gamma/tags-sync'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = parsePositiveInt(url.searchParams.get('limit'))

  try {
    const result = await runTagsSync({ limit })
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown tags-sync error'
    console.error('tags-sync failed:', error)
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
