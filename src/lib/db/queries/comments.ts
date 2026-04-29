import type { Comment } from '@/types'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  comment_reactions as commentReactionsTable,
  comments as commentsTable,
  events as eventsTable,
  polymarket_users as polymarketUsersTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export type CommentSortOrder = 'recent' | 'top'

interface CommentRow {
  id: string
  event_id: string
  parent_comment_id: string | null
  body: string
  reactions_count: number
  created_at: Date
  updated_at: Date
  external_source: string
  base_address: string
  proxy_wallet: string | null
  pseudonym: string | null
  display_name: string | null
  display_username_public: boolean | null
  profile_image: string | null
  profile_image_optimized: string | null
}

/**
 * Translate a join row into the kuest-shaped `Comment` type. The display
 * username falls back through `name → pseudonym → address` when
 * `displayUsernamePublic` is true; otherwise we always use the pseudonym
 * (so private profiles never leak the real name).
 */
function toComment(
  row: CommentRow,
  viewerAddress: string | null,
  likedSet: ReadonlySet<string>,
): Comment {
  const username = row.display_username_public
    ? row.display_name?.trim() || row.pseudonym?.trim() || row.base_address
    : row.pseudonym?.trim() || row.base_address
  const avatar = row.profile_image_optimized ?? row.profile_image ?? ''

  return {
    id: row.id,
    content: row.body,
    user_id: row.base_address,
    username,
    user_avatar: avatar,
    user_address: row.base_address,
    user_proxy_wallet_address: row.proxy_wallet,
    likes_count: row.reactions_count,
    replies_count: 0,
    created_at: row.created_at.toISOString(),
    is_owner: viewerAddress != null && row.base_address === viewerAddress.toLowerCase(),
    user_has_liked: likedSet.has(row.id),
    positions: [],
    recent_replies: undefined,
  }
}

async function fetchLikedSet(
  commentIds: readonly string[],
  viewerAddress: string | null,
): Promise<Set<string>> {
  if (!viewerAddress || commentIds.length === 0) {
    return new Set<string>()
  }
  const rows = await db
    .select({ comment_id: commentReactionsTable.comment_id })
    .from(commentReactionsTable)
    .where(and(
      eq(commentReactionsTable.reactor_base_address, viewerAddress.toLowerCase()),
      eq(commentReactionsTable.reaction_type, 'like'),
      inArray(commentReactionsTable.comment_id, [...commentIds]),
    ))
  return new Set(rows.map(r => r.comment_id))
}

const SELECT_FIELDS = {
  id: commentsTable.id,
  event_id: commentsTable.event_id,
  parent_comment_id: commentsTable.parent_comment_id,
  body: commentsTable.body,
  reactions_count: commentsTable.reactions_count,
  created_at: commentsTable.created_at,
  updated_at: commentsTable.updated_at,
  external_source: commentsTable.external_source,
  base_address: polymarketUsersTable.base_address,
  proxy_wallet: polymarketUsersTable.proxy_wallet,
  pseudonym: polymarketUsersTable.pseudonym,
  display_name: polymarketUsersTable.name,
  display_username_public: polymarketUsersTable.display_username_public,
  profile_image: polymarketUsersTable.profile_image,
  profile_image_optimized: polymarketUsersTable.profile_image_optimized,
} as const

/**
 * Paginated, top-level comments for a given event slug. Replies are returned
 * separately via `listReplies`; the top-level list only includes rows whose
 * `parent_comment_id IS NULL`.
 *
 * `holdersAllowlist` (when provided) restricts results to comments authored by
 * one of the supplied `polymarket_users.base_address` values. An empty Set is
 * a valid input and yields zero rows; pass `null` (or omit) to disable the
 * filter entirely.
 */
export async function listEventComments(args: {
  eventSlug: string
  limit: number
  offset: number
  sortBy: CommentSortOrder
  viewerAddress: string | null
  holdersAllowlist?: ReadonlySet<string> | null
}): Promise<Comment[]> {
  const orderBy = args.sortBy === 'top'
    ? [desc(commentsTable.reactions_count), desc(commentsTable.created_at)]
    : [desc(commentsTable.created_at)]

  const conditions = [
    eq(eventsTable.slug, args.eventSlug),
    eq(commentsTable.is_hidden, false),
    isNull(commentsTable.parent_comment_id),
  ]

  if (args.holdersAllowlist) {
    if (args.holdersAllowlist.size === 0) {
      return []
    }
    conditions.push(inArray(commentsTable.author_base_address, [...args.holdersAllowlist]))
  }

  const rows = await db
    .select(SELECT_FIELDS)
    .from(commentsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, commentsTable.event_id))
    .innerJoin(
      polymarketUsersTable,
      eq(polymarketUsersTable.base_address, commentsTable.author_base_address),
    )
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(args.limit)
    .offset(args.offset)

  const liked = await fetchLikedSet(rows.map(r => r.id), args.viewerAddress)
  return rows.map(row => toComment(row as CommentRow, args.viewerAddress, liked))
}

export async function listReplies(args: {
  parentCommentId: string
  limit: number
  viewerAddress: string | null
}): Promise<Comment[]> {
  const rows = await db
    .select(SELECT_FIELDS)
    .from(commentsTable)
    .innerJoin(
      polymarketUsersTable,
      eq(polymarketUsersTable.base_address, commentsTable.author_base_address),
    )
    .where(and(
      eq(commentsTable.parent_comment_id, args.parentCommentId),
      eq(commentsTable.is_hidden, false),
    ))
    .orderBy(commentsTable.created_at)
    .limit(args.limit)

  const liked = await fetchLikedSet(rows.map(r => r.id), args.viewerAddress)
  return rows.map(row => toComment(row as CommentRow, args.viewerAddress, liked))
}

export async function countEventComments(eventSlug: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(commentsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, commentsTable.event_id))
    .where(and(
      eq(eventsTable.slug, eventSlug),
      eq(commentsTable.is_hidden, false),
    ))

  return rows[0]?.count ?? 0
}

export interface EventCommentMetrics {
  comments_count: number
  users_count: number
  likes_count: number
  reports_count: number
}

/**
 * Mirrors the kuest `/comments/metrics` 4-tuple.
 *  - comments_count: visible (non-hidden) rows for the event
 *  - users_count   : unique authors of those rows
 *  - likes_count   : sum of reactions on those rows
 *  - reports_count : sum of reports on those rows
 */
export async function getEventCommentMetrics(eventSlug: string): Promise<EventCommentMetrics> {
  const rows = await db
    .select({
      comments_count: sql<number>`COUNT(${commentsTable.id})::int`,
      users_count: sql<number>`COUNT(DISTINCT ${commentsTable.author_base_address})::int`,
      likes_count: sql<number>`COALESCE(SUM(${commentsTable.reactions_count}), 0)::int`,
      reports_count: sql<number>`COALESCE(SUM(${commentsTable.reports_count}), 0)::int`,
    })
    .from(commentsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, commentsTable.event_id))
    .where(and(
      eq(eventsTable.slug, eventSlug),
      eq(commentsTable.is_hidden, false),
    ))

  const row = rows[0]
  return {
    comments_count: row?.comments_count ?? 0,
    users_count: row?.users_count ?? 0,
    likes_count: row?.likes_count ?? 0,
    reports_count: row?.reports_count ?? 0,
  }
}

export interface InsertNativeCommentArgs {
  eventSlug: string
  authorBaseAddress: string
  body: string
  parentCommentId: string | null
}

export interface InsertNativeCommentResult {
  comment: Comment
}

export class CommentValidationError extends Error {
  constructor(public readonly code: 'event_not_found' | 'parent_not_found' | 'parent_event_mismatch' | 'body_invalid', message: string) {
    super(message)
    this.name = 'CommentValidationError'
  }
}

/**
 * Insert a native (`external_source='native'`) comment authored by the connected
 * user. The author MUST already exist in `polymarket_users` (call
 * `upsertSessionUserToPolymarketUsers` first) — the FK enforces it.
 *
 * Validates `parent_comment_id` belongs to the same event before insert so a
 * reply can never be re-parented across events.
 */
export async function insertNativeComment(
  args: InsertNativeCommentArgs,
  viewerAddress: string,
): Promise<InsertNativeCommentResult> {
  const trimmed = args.body.trim()
  if (trimmed.length === 0 || trimmed.length > 2000) {
    throw new CommentValidationError('body_invalid', 'Comment must be between 1 and 2000 characters.')
  }

  const eventRow = await db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(eq(eventsTable.slug, args.eventSlug))
    .limit(1)
  const eventId = eventRow[0]?.id
  if (!eventId) {
    throw new CommentValidationError('event_not_found', 'Event not found.')
  }

  if (args.parentCommentId) {
    const parentRow = await db
      .select({ event_id: commentsTable.event_id })
      .from(commentsTable)
      .where(eq(commentsTable.id, args.parentCommentId))
      .limit(1)
    const parent = parentRow[0]
    if (!parent) {
      throw new CommentValidationError('parent_not_found', 'Parent comment not found.')
    }
    if (parent.event_id !== eventId) {
      throw new CommentValidationError('parent_event_mismatch', 'Parent comment belongs to a different event.')
    }
  }

  const inserted = await db
    .insert(commentsTable)
    .values({
      event_id: eventId,
      parent_comment_id: args.parentCommentId,
      author_base_address: args.authorBaseAddress.toLowerCase(),
      body: trimmed,
      external_source: 'native',
      external_id: null,
    })
    .returning({ id: commentsTable.id })

  const newId = inserted[0]?.id
  if (!newId) {
    throw new Error('Failed to insert comment')
  }

  const rows = await db
    .select(SELECT_FIELDS)
    .from(commentsTable)
    .innerJoin(
      polymarketUsersTable,
      eq(polymarketUsersTable.base_address, commentsTable.author_base_address),
    )
    .where(eq(commentsTable.id, newId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new Error('Inserted comment vanished on read-back')
  }

  return {
    comment: toComment(row as CommentRow, viewerAddress, new Set<string>()),
  }
}

export interface ToggleReactionResult {
  likes_count: number
  user_has_liked: boolean
}

/**
 * Toggle a `'like'` reaction by the viewer on the given comment. Reaction
 * count on `comments` is kept in sync with the `comment_reactions` table by
 * the same statement (atomic insert/delete + `UPDATE comments SET
 * reactions_count = ...`).
 */
export async function toggleCommentLike(commentId: string, reactorBaseAddress: string): Promise<ToggleReactionResult> {
  const reactor = reactorBaseAddress.toLowerCase()

  const existing = await db
    .select({ comment_id: commentReactionsTable.comment_id })
    .from(commentReactionsTable)
    .where(and(
      eq(commentReactionsTable.comment_id, commentId),
      eq(commentReactionsTable.reactor_base_address, reactor),
      eq(commentReactionsTable.reaction_type, 'like'),
    ))
    .limit(1)

  let userHasLiked: boolean
  if (existing.length > 0) {
    await db
      .delete(commentReactionsTable)
      .where(and(
        eq(commentReactionsTable.comment_id, commentId),
        eq(commentReactionsTable.reactor_base_address, reactor),
        eq(commentReactionsTable.reaction_type, 'like'),
      ))
    userHasLiked = false
  }
  else {
    await db
      .insert(commentReactionsTable)
      .values({
        comment_id: commentId,
        reactor_base_address: reactor,
        reaction_type: 'like',
      })
      .onConflictDoNothing()
    userHasLiked = true
  }

  const counts = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(commentReactionsTable)
    .where(and(
      eq(commentReactionsTable.comment_id, commentId),
      eq(commentReactionsTable.reaction_type, 'like'),
    ))
  const likesCount = counts[0]?.count ?? 0

  await db
    .update(commentsTable)
    .set({ reactions_count: likesCount, updated_at: sql`NOW()` })
    .where(eq(commentsTable.id, commentId))

  return { likes_count: likesCount, user_has_liked: userHasLiked }
}

/**
 * Owner-only soft delete. Returns true on success; false if the comment doesn't
 * exist or the viewer is not the author. Soft-delete (is_hidden=TRUE) preserves
 * thread shape for replies and keeps the seed data immutable.
 */
export async function deleteOwnComment(commentId: string, requesterBaseAddress: string): Promise<boolean> {
  const requester = requesterBaseAddress.toLowerCase()

  const result = await db
    .update(commentsTable)
    .set({ is_hidden: true, updated_at: sql`NOW()` })
    .where(and(
      eq(commentsTable.id, commentId),
      eq(commentsTable.author_base_address, requester),
      eq(commentsTable.is_hidden, false),
    ))
    .returning({ id: commentsTable.id })

  return result.length > 0
}
