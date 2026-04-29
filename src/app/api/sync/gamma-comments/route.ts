import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runCommentsSync } from '@/lib/gamma/comments-sync'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitPerEvent = parsePositiveInt(url.searchParams.get('limit'))
  const maxEventsPerRun = parsePositiveInt(url.searchParams.get('maxEvents'))

  try {
    const result = await runCommentsSync({ limitPerEvent, maxEventsPerRun })
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown comments-sync error'
    console.error('comments-sync failed:', error)
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
