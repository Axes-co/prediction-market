import { NextResponse } from 'next/server'
import { getCommentSessionUser } from '@/lib/comments/session'
import { toggleCommentLike } from '@/lib/db/queries/comments'
import { upsertSessionUserMirror } from '@/lib/db/queries/polymarket-users'

export const maxDuration = 10

interface ReactionBody {
  action?: string
}

/**
 * Native replacement for `community.kuest.com/comments/{id}/reactions`. The
 * kuest contract is a single `{ action: 'toggle' }` body; we only support
 * `'toggle'` (the only action the existing client sends) and return the same
 * `{ likes_count, user_has_liked }` shape so the hook upgrades transparently.
 */
export async function POST(
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

  let body: ReactionBody = {}
  try {
    body = await request.json() as ReactionBody
  }
  catch {
    body = {}
  }
  const action = typeof body.action === 'string' ? body.action : 'toggle'
  if (action !== 'toggle') {
    return NextResponse.json({ error: 'unsupported action' }, { status: 400 })
  }

  await upsertSessionUserMirror({
    baseAddress: viewer.base_address,
    proxyWallet: viewer.proxy_wallet_address,
    username: viewer.username,
    image: viewer.image,
  })

  try {
    const result = await toggleCommentLike(id, viewer.base_address)
    return NextResponse.json(result)
  }
  catch (error) {
    console.error('Failed to toggle comment reaction', error)
    return NextResponse.json({ error: 'failed to toggle reaction' }, { status: 500 })
  }
}
