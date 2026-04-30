import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runLeaderboardSync } from '@/lib/data-api/leaderboard-sync'

export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const topN = parsePositiveInt(url.searchParams.get('topN')) ?? undefined

  try {
    const result = await runLeaderboardSync({ topN })
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'unknown leaderboard-sync error'
    console.error('leaderboard-sync failed:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
