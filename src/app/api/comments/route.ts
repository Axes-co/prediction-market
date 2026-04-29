import { NextResponse } from 'next/server'
import { getEventHoldersAllowlist } from '@/lib/comments/holders-allowlist'
import { getCommentSessionUser } from '@/lib/comments/session'
import {
  CommentValidationError,
  insertNativeComment,
  listEventComments,
} from '@/lib/db/queries/comments'
import { upsertSessionUserMirror } from '@/lib/db/queries/polymarket-users'

export const maxDuration = 15

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const MAX_OFFSET = 10_000

/**
 * Native replacement for `community.kuest.com/comments`. Returns the same
 * `Comment[]` shape the existing hooks consume; reads from our `comments`
 * table (seeded by the gamma-comments cron + native posts).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const eventSlug = url.searchParams.get('event_slug')?.trim()
  if (!eventSlug) {
    return NextResponse.json({ error: 'event_slug is required' }, { status: 400 })
  }

  const limit = clamp(Number.parseInt(url.searchParams.get('limit') ?? '', 10), 1, MAX_LIMIT, DEFAULT_LIMIT)
  const offset = clamp(Number.parseInt(url.searchParams.get('offset') ?? '', 10), 0, MAX_OFFSET, 0)
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'recent'
  const holdersOnly = url.searchParams.get('holders_only') === 'true'

  const viewer = await getCommentSessionUser(request)

  const holdersAllowlist = holdersOnly
    ? await getEventHoldersAllowlist(eventSlug)
    : null

  const comments = await listEventComments({
    eventSlug,
    limit,
    offset,
    sortBy: sort,
    viewerAddress: viewer?.base_address ?? null,
    holdersAllowlist,
  })

  return NextResponse.json(comments)
}

interface CreateCommentBody {
  event_slug?: string
  content?: string
  parent_comment_id?: string | null
}

/**
 * Create a native comment. Auth comes from the existing better-auth SIWE
 * session cookie — no parallel Bearer token. The session user is mirrored
 * into `polymarket_users` first so the FK on `comments.author_base_address`
 * is always satisfied.
 */
export async function POST(request: Request) {
  const viewer = await getCommentSessionUser(request)
  if (!viewer) {
    return NextResponse.json({ error: 'missing authorization' }, { status: 401 })
  }

  let body: CreateCommentBody
  try {
    body = await request.json() as CreateCommentBody
  }
  catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const eventSlug = body.event_slug?.trim()
  if (!eventSlug) {
    return NextResponse.json({ error: 'event_slug is required' }, { status: 400 })
  }
  const content = typeof body.content === 'string' ? body.content : ''
  const parentCommentId = typeof body.parent_comment_id === 'string' && body.parent_comment_id.length > 0
    ? body.parent_comment_id
    : null

  await upsertSessionUserMirror({
    baseAddress: viewer.base_address,
    proxyWallet: viewer.proxy_wallet_address,
    username: viewer.username,
    image: viewer.image,
  })

  try {
    const result = await insertNativeComment(
      {
        eventSlug,
        authorBaseAddress: viewer.base_address,
        body: content,
        parentCommentId,
      },
      viewer.base_address,
    )
    return NextResponse.json(result.comment, { status: 201 })
  }
  catch (error) {
    if (error instanceof CommentValidationError) {
      const status = error.code === 'event_not_found' || error.code === 'parent_not_found' ? 404 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error('Failed to insert native comment', error)
    return NextResponse.json({ error: 'failed to create comment' }, { status: 500 })
  }
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(Math.max(Math.trunc(value), min), max)
}
