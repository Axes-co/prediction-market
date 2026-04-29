import { NextResponse } from 'next/server'
import { getCommentSessionUser } from '@/lib/comments/session'
import { listReplies } from '@/lib/db/queries/comments'

export const maxDuration = 15

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * Native replacement for `community.kuest.com/comments/{id}/replies`. Returns
 * top-of-thread replies for the given parent comment id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params
  const id = commentId?.trim()
  if (!id) {
    return NextResponse.json({ error: 'comment id is required' }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = clamp(Number.parseInt(url.searchParams.get('limit') ?? '', 10), 1, MAX_LIMIT, DEFAULT_LIMIT)

  const viewer = await getCommentSessionUser(request)
  const replies = await listReplies({
    parentCommentId: id,
    limit,
    viewerAddress: viewer?.base_address ?? null,
  })

  return NextResponse.json(replies)
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(Math.max(Math.trunc(value), min), max)
}
