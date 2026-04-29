import { eq, sql } from 'drizzle-orm'
import { polymarket_users as polymarketUsers } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export type PolymarketUserSource = 'comments' | 'activity' | 'holders' | 'leaderboard' | 'trades'

export interface CommentProfileSnapshot {
  baseAddress?: string | null
  proxyWallet?: string | null
  pseudonym?: string | null
  name?: string | null
  displayUsernamePublic?: boolean | null
  bio?: string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
}

export interface ActivityProfileSnapshot {
  proxyWallet?: string | null
  pseudonym?: string | null
  name?: string | null
  bio?: string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
}

export interface HolderProfileSnapshot {
  proxyWallet?: string | null
  pseudonym?: string | null
  name?: string | null
  bio?: string | null
  profileImage?: string | null
  profileImageOptimized?: string | null
}

export interface PolymarketUserRow {
  base_address: string
  proxy_wallet: string | null
  pseudonym: string | null
  name: string | null
  display_username_public: boolean | null
  bio: string | null
  profile_image: string | null
  profile_image_optimized: string | null
  first_seen_at: Date
  last_seen_at: Date
  source: string
}

const ADDRESS_PATTERN = /^0x[a-f0-9]{40}$/

function normalizeAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  return ADDRESS_PATTERN.test(trimmed) ? trimmed : null
}

function clampString(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

interface UpsertArgs {
  baseAddress: string
  proxyWallet: string | null
  pseudonym: string | null
  name: string | null
  displayUsernamePublic: boolean | null
  bio: string | null
  profileImage: string | null
  profileImageOptimized: string | null
  source: PolymarketUserSource
}

async function upsertOne(args: UpsertArgs): Promise<void> {
  await db
    .insert(polymarketUsers)
    .values({
      base_address: args.baseAddress,
      proxy_wallet: args.proxyWallet,
      pseudonym: args.pseudonym,
      name: args.name,
      display_username_public: args.displayUsernamePublic,
      bio: args.bio,
      profile_image: args.profileImage,
      profile_image_optimized: args.profileImageOptimized,
      source: args.source,
    })
    .onConflictDoUpdate({
      target: polymarketUsers.base_address,
      set: {
        // COALESCE preserves any non-null value already on file: an observation that
        // omits a field never overwrites a fresher one. Polymarket profile data can
        // be partial across sources (holders rows lack baseAddress, activity rows
        // lack displayUsernamePublic), and we want to accumulate without regression.
        proxy_wallet: sql`COALESCE(${polymarketUsers.proxy_wallet}, EXCLUDED.proxy_wallet)`,
        pseudonym: sql`COALESCE(EXCLUDED.pseudonym, ${polymarketUsers.pseudonym})`,
        name: sql`COALESCE(EXCLUDED.name, ${polymarketUsers.name})`,
        display_username_public: sql`COALESCE(EXCLUDED.display_username_public, ${polymarketUsers.display_username_public})`,
        bio: sql`COALESCE(EXCLUDED.bio, ${polymarketUsers.bio})`,
        profile_image: sql`COALESCE(EXCLUDED.profile_image, ${polymarketUsers.profile_image})`,
        profile_image_optimized: sql`COALESCE(EXCLUDED.profile_image_optimized, ${polymarketUsers.profile_image_optimized})`,
        last_seen_at: sql`NOW()`,
        // `source` is the most recent observation source for diagnostics; not authoritative.
        source: sql`EXCLUDED.source`,
      },
    })
}

/**
 * Upsert a polymarket_users row from a gamma comment's `profile` object.
 * Returns silently when the snapshot lacks a usable base address; never throws
 * — these are background fire-and-forget writes from read paths.
 */
export async function upsertFromCommentProfile(
  commentUserAddress: string | null | undefined,
  profile: CommentProfileSnapshot | null | undefined,
): Promise<void> {
  const baseAddress = normalizeAddress(profile?.baseAddress) ?? normalizeAddress(commentUserAddress)
  if (!baseAddress) {
    return
  }

  try {
    await upsertOne({
      baseAddress,
      proxyWallet: normalizeAddress(profile?.proxyWallet),
      pseudonym: clampString(profile?.pseudonym, 80),
      name: clampString(profile?.name, 80),
      displayUsernamePublic: typeof profile?.displayUsernamePublic === 'boolean' ? profile.displayUsernamePublic : null,
      bio: clampString(profile?.bio, 1000),
      profileImage: clampString(profile?.profileImage, 1000),
      profileImageOptimized: clampString(profile?.profileImageOptimized, 1000),
      source: 'comments',
    })
  }
  catch (error) {
    console.warn('polymarket_users upsert (comments) failed', error)
  }
}

/**
 * Upsert from a data-api `/activity` row. Activity rows surface `proxyWallet`
 * but rarely the EOA, so we use proxyWallet as the base when no baseAddress is
 * supplied — this keeps a row alive for cross-referencing with comments later.
 */
export async function upsertFromActivityRow(
  proxyWalletOrBase: string | null | undefined,
  profile: ActivityProfileSnapshot | null | undefined,
): Promise<void> {
  const proxyWallet = normalizeAddress(profile?.proxyWallet) ?? normalizeAddress(proxyWalletOrBase)
  const baseAddress = proxyWallet
  if (!baseAddress) {
    return
  }

  try {
    await upsertOne({
      baseAddress,
      proxyWallet,
      pseudonym: clampString(profile?.pseudonym, 80),
      name: clampString(profile?.name, 80),
      displayUsernamePublic: null,
      bio: clampString(profile?.bio, 1000),
      profileImage: clampString(profile?.profileImage, 1000),
      profileImageOptimized: clampString(profile?.profileImageOptimized, 1000),
      source: 'activity',
    })
  }
  catch (error) {
    console.warn('polymarket_users upsert (activity) failed', error)
  }
}

/**
 * Upsert from a data-api `/holders` row.
 */
export async function upsertFromHolderRow(
  proxyWalletOrBase: string | null | undefined,
  profile: HolderProfileSnapshot | null | undefined,
): Promise<void> {
  const proxyWallet = normalizeAddress(profile?.proxyWallet) ?? normalizeAddress(proxyWalletOrBase)
  const baseAddress = proxyWallet
  if (!baseAddress) {
    return
  }

  try {
    await upsertOne({
      baseAddress,
      proxyWallet,
      pseudonym: clampString(profile?.pseudonym, 80),
      name: clampString(profile?.name, 80),
      displayUsernamePublic: null,
      bio: clampString(profile?.bio, 1000),
      profileImage: clampString(profile?.profileImage, 1000),
      profileImageOptimized: clampString(profile?.profileImageOptimized, 1000),
      source: 'holders',
    })
  }
  catch (error) {
    console.warn('polymarket_users upsert (holders) failed', error)
  }
}

export interface SessionUserSnapshot {
  baseAddress: string | null | undefined
  proxyWallet: string | null | undefined
  username: string | null | undefined
  image: string | null | undefined
}

/**
 * Mirror the connected session user into `polymarket_users`. Required before
 * inserting a native comment (FK), and idempotent so repeated POSTs are cheap.
 * `name` is set from the better-auth `username` only on first insert; on
 * subsequent calls COALESCE preserves whatever's already stored.
 */
export async function upsertSessionUserMirror(snapshot: SessionUserSnapshot): Promise<string | null> {
  const baseAddress = normalizeAddress(snapshot.baseAddress)
  if (!baseAddress) {
    return null
  }
  await upsertOne({
    baseAddress,
    proxyWallet: normalizeAddress(snapshot.proxyWallet),
    pseudonym: clampString(snapshot.username, 80),
    name: clampString(snapshot.username, 80),
    displayUsernamePublic: true,
    bio: null,
    profileImage: clampString(snapshot.image, 1000),
    profileImageOptimized: clampString(snapshot.image, 1000),
    source: 'comments',
  })
  return baseAddress
}

export async function getByAddress(address: string | null | undefined): Promise<PolymarketUserRow | null> {
  const normalized = normalizeAddress(address)
  if (!normalized) {
    return null
  }

  const rows = await db
    .select()
    .from(polymarketUsers)
    .where(eq(polymarketUsers.base_address, normalized))
    .limit(1)

  return rows[0] ?? null
}
