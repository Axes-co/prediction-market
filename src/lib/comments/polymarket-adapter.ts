import type { Comment } from '@/types'

/**
 * The shape of a comment row from `gamma-api.polymarket.com/comments`.
 * Verified live this session via `GET /comments?parent_entity_type=Event&parent_entity_id=30615`.
 *
 * `parentEntityType` is `"Event"`, `"Series"`, or `"market"` (lowercase) per
 * gamma-openapi.yaml. `userAddress` is the EOA; `profile.proxyWallet` is the
 * Safe; `profile.baseAddress` mirrors `userAddress` when present.
 */
export interface PolymarketCommentProfile {
  name?: string | null
  pseudonym?: string | null
  displayUsernamePublic?: boolean | null
  bio?: string | null
  proxyWallet?: string | null
  baseAddress?: string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
  isMod?: boolean | null
  isCreator?: boolean | null
}

export interface PolymarketCommentReaction {
  id?: string | null
  commentID?: string | null
  reactionType?: string | null
  icon?: string | null
  userAddress?: string | null
  createdAt?: string | null
  profile?: PolymarketCommentProfile | null
}

export interface PolymarketComment {
  id: string
  body?: string | null
  parentEntityType?: string | null
  parentEntityID?: number | null
  parentCommentID?: string | null
  userAddress?: string | null
  replyAddress?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  profile?: PolymarketCommentProfile | null
  reactions?: PolymarketCommentReaction[] | null
  reportCount?: number | null
  reactionCount?: number | null
}

/**
 * Convert a gamma comment into the existing `Comment` shape consumed by
 * `EventCommentItem.tsx` and friends. Missing fields fall back to safe defaults
 * so a Polymarket-sourced comment never crashes a kuest-shaped consumer.
 *
 * `currentUserAddress` is the connected wallet (lowercase or checksummed) —
 * we lowercase both sides for the `is_owner` check.
 */
export function adaptPolymarketComment(
  raw: PolymarketComment,
  currentUserAddress: string | null,
): Comment {
  const profile = raw.profile ?? {}
  const userAddress = raw.userAddress ?? profile.baseAddress ?? ''
  const username = resolveUsername(profile, userAddress)
  const avatar = profile.profileImageOptimized ?? profile.profileImage ?? ''

  return {
    id: raw.id,
    content: raw.body ?? '',
    user_id: userAddress,
    username,
    user_avatar: avatar,
    user_address: userAddress,
    user_proxy_wallet_address: profile.proxyWallet ?? null,
    likes_count: typeof raw.reactionCount === 'number' && raw.reactionCount >= 0 ? raw.reactionCount : 0,
    // gamma's `/comments` list endpoint doesn't include reply counts inline.
    // Consumers fetch replies via `?parent_entity_type=Comment&parent_entity_id=<id>` when needed.
    // Hydrating reply counts up front would 1+N; we accept zero here.
    replies_count: 0,
    created_at: raw.createdAt ?? new Date().toISOString(),
    is_owner: ownsComment(userAddress, currentUserAddress),
    // Gamma's public list does not include per-user reaction state. Polymarket's authenticated
    // endpoint may return reactions per user but we are read-only at launch (Phase 7 deferral).
    user_has_liked: false,
    // Gamma comments do not carry a `positions` field. The kuest UI hides the
    // positions indicator when this array is empty (`EventCommentPositionsIndicator`).
    positions: [],
    recent_replies: undefined,
  }
}

/**
 * Convert an array of gamma comments. Filters out entries missing the `id` field
 * so consumers never receive a partial Comment.
 */
export function adaptPolymarketComments(
  raw: PolymarketComment[],
  currentUserAddress: string | null,
): Comment[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .filter((entry): entry is PolymarketComment => Boolean(entry?.id))
    .map(entry => adaptPolymarketComment(entry, currentUserAddress))
}

function resolveUsername(profile: PolymarketCommentProfile, fallbackAddress: string): string {
  const trimmedName = profile.name?.trim()
  const trimmedPseudonym = profile.pseudonym?.trim()
  if (profile.displayUsernamePublic) {
    return trimmedName || trimmedPseudonym || fallbackAddress
  }
  return trimmedPseudonym || fallbackAddress
}

function ownsComment(commentAddress: string, viewer: string | null): boolean {
  if (!commentAddress || !viewer) {
    return false
  }
  return commentAddress.toLowerCase() === viewer.toLowerCase()
}
