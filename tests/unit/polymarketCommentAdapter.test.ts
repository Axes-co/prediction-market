import { describe, expect, it } from 'vitest'
import {
  adaptPolymarketComment,
  adaptPolymarketComments,
  type PolymarketComment,
} from '@/lib/comments/polymarket-adapter'

const baseComment: PolymarketComment = {
  id: '2856275',
  body: 'France to win !',
  parentEntityType: 'Event',
  parentEntityID: 30615,
  userAddress: '0x605e6fd2aab5827fa88f8e5f640f9f76b97e3c34',
  createdAt: '2026-04-28T23:47:39.842333Z',
  updatedAt: '2026-04-28T23:47:51.869699Z',
  profile: {
    name: 'thiagofelipe',
    pseudonym: 'Bronze-Corporation',
    displayUsernamePublic: true,
    bio: '',
    proxyWallet: '0xda25452547d537e7196e2655b31773c5fc3babaf',
    baseAddress: '0x605e6fd2aab5827fa88f8e5f640f9f76b97e3c34',
  },
  reportCount: 0,
  reactionCount: 0,
}

describe('adaptPolymarketComment', () => {
  it('maps the canonical gamma comment shape', () => {
    const result = adaptPolymarketComment(baseComment, null)
    expect(result.id).toBe('2856275')
    expect(result.content).toBe('France to win !')
    expect(result.user_address).toBe('0x605e6fd2aab5827fa88f8e5f640f9f76b97e3c34')
    expect(result.user_proxy_wallet_address).toBe('0xda25452547d537e7196e2655b31773c5fc3babaf')
    expect(result.username).toBe('thiagofelipe')
    expect(result.likes_count).toBe(0)
    expect(result.replies_count).toBe(0)
    expect(result.is_owner).toBe(false)
    expect(result.user_has_liked).toBe(false)
    expect(result.positions).toEqual([])
  })

  it('falls back to pseudonym when displayUsernamePublic is false', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, profile: { ...baseComment.profile, displayUsernamePublic: false } },
      null,
    )
    expect(result.username).toBe('Bronze-Corporation')
  })

  it('falls back to address when neither name nor pseudonym is present', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, profile: { displayUsernamePublic: true } },
      null,
    )
    expect(result.username).toBe('0x605e6fd2aab5827fa88f8e5f640f9f76b97e3c34')
  })

  it('marks ownership when current user matches userAddress (case-insensitive)', () => {
    const result = adaptPolymarketComment(baseComment, '0x605E6FD2AAB5827FA88F8E5F640F9F76B97E3C34')
    expect(result.is_owner).toBe(true)
  })

  it('uses optimized profile image when available', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, profile: { ...baseComment.profile, profileImageOptimized: 'https://example.test/avatar.webp' } },
      null,
    )
    expect(result.user_avatar).toBe('https://example.test/avatar.webp')
  })

  it('falls back to profileImage when optimized variant is missing', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, profile: { ...baseComment.profile, profileImage: 'https://example.test/avatar.png' } },
      null,
    )
    expect(result.user_avatar).toBe('https://example.test/avatar.png')
  })

  it('handles missing reactionCount gracefully', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, reactionCount: undefined },
      null,
    )
    expect(result.likes_count).toBe(0)
  })

  it('preserves a positive reactionCount', () => {
    const result = adaptPolymarketComment(
      { ...baseComment, reactionCount: 17 },
      null,
    )
    expect(result.likes_count).toBe(17)
  })

  it('handles missing body and createdAt without crashing', () => {
    const result = adaptPolymarketComment(
      { id: 'x', userAddress: '0xabc', profile: {} },
      null,
    )
    expect(result.content).toBe('')
    expect(typeof result.created_at).toBe('string')
  })
})

describe('adaptPolymarketComments', () => {
  it('filters entries missing an id', () => {
    const result = adaptPolymarketComments(
      [baseComment, { id: '', body: 'orphan' } as PolymarketComment, baseComment],
      null,
    )
    expect(result).toHaveLength(2)
  })

  it('returns empty array on non-array input', () => {
    expect(adaptPolymarketComments(null as unknown as PolymarketComment[], null)).toEqual([])
  })
})
