import { NextResponse } from 'next/server'
import { getCommentSessionUser } from '@/lib/comments/session'
import { deleteOwnComment } from '@/lib/db/queries/comments'

export const maxDuration = 10

/**
 * Native replacement for `community.kuest.com/comments/{id}` DELETE. Owner-only
 * soft-delete (sets `is_hidden=TRUE`); the row stays in the table to keep
 * thread shape and to preserve seed-data immutability. Anyone other than the
 * author is silently treated as 404.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params
  const id = commentId?.trim()
  if (!id) {
    return NextResponse.json({ error: 'comment id is required' }, { status: 400 })
  }

  const viewer = await getCommentSessionUser(request)
  if (!viewer) {
    return NextResponse.json({ error: 'missing authorization' }, { status: 401 })
  }

  try {
    const ok = await deleteOwnComment(id, viewer.base_address)
    if (!ok) {
      return NextResponse.json({ error: 'comment not found' }, { status: 404 })
    }
    return NextResponse.json({ id, deleted: true })
  }
  catch (error) {
    console.error('Failed to delete comment', error)
    return NextResponse.json({ error: 'failed to delete comment' }, { status: 500 })
  }
}
