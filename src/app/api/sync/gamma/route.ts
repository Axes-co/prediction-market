import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/auth-cron'
import { runGammaSync } from '@/lib/gamma/sync'
import { resetGammaSyncCursors, wipeGammaSourcedData } from '@/lib/gamma/wipe'

// Pro plan max. Three lanes × per-event market upserts (sports events ship
// 40+ markets each) ran past 300s and got the lambda killed mid-write,
// leaking the gamma_sync lock for STALE_AFTER_MS (15 min). Internal budget
// in src/lib/gamma/sync.ts (DEFAULT_TIME_LIMIT_MS) is 500s so the route
// always exits cleanly with `releaseGammaSyncLock('completed')` and ~100s
// of buffer for response flush.
export const maxDuration = 600

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
  // Destructive: clears every events/markets/conditions/outcomes row plus the
  // cascading children (comments, event_tags, event_translations, etc.) so
  // the next sync pass re-populates from scratch with the current mapper
  // output. Useful after a schema migration that adds columns the old data
  // couldn't carry. Cron-authed; not exposed on a non-cron path.
  const wipe = url.searchParams.get('wipe') === 'true'
  const clearTags = url.searchParams.get('clearTags') === 'true'
  // Non-destructive: keep rows in place, just rewind cursors so the next pass
  // re-paginates from offset 0 of the volume-sorted feed.
  const resetCursors = url.searchParams.get('resetCursors') === 'true'

  try {
    let wipeResult: { events_deleted: number, conditions_deleted: number, tags_deleted: number } | null = null
    if (wipe) {
      wipeResult = await wipeGammaSourcedData({ clearTags })
    }
    else if (resetCursors) {
      await resetGammaSyncCursors()
    }

    const result = await runGammaSync({
      // After a wipe/reset the persisted cursor was cleared, so an explicit
      // `?cursor=` override is the only way to resume mid-feed.
      startCursor: wipe || resetCursors ? null : startCursor,
      pageSize,
      maxPagesPerSource,
      sourceUrls,
    })
    return NextResponse.json({ success: true, wipe: wipeResult, ...result })
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
