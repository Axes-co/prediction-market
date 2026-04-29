import { NextResponse } from 'next/server'
import { getEventCommentMetrics } from '@/lib/db/queries/comments'

export const maxDuration = 10

/**
 * Native replacement for `community.kuest.com/comments/metrics`. Returns the
 * full kuest 4-tuple (`comments_count`, `users_count`, `likes_count`,
 * `reports_count`) so existing badge/UI consumers can drop in unchanged.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventSlug = url.searchParams.get('event_slug')?.trim()
  if (!eventSlug) {
    return NextResponse.json({ error: 'event_slug is required' }, { status: 400 })
  }

  const metrics = await getEventCommentMetrics(eventSlug)
  return NextResponse.json(metrics)
}
