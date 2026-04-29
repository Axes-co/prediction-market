import { describe, expect, it } from 'vitest'
import { adaptPolymarketComments } from '@/lib/comments/polymarket-adapter'

describe.skipIf(process.env.SKIP_LIVE_TESTS === '1')('live: gamma → adapter', () => {
  it('adapts a live response without throwing', async () => {
    const r = await fetch('https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=30615&limit=3')
    expect(r.ok).toBe(true)
    const raw = await r.json() as any[]
    expect(Array.isArray(raw)).toBe(true)
    const adapted = adaptPolymarketComments(raw, null)
    expect(adapted.length).toBeGreaterThan(0)
    for (const c of adapted) {
      expect(c.id).toBeTypeOf('string')
      expect(c.user_address).toMatch(/^0x[a-fA-F0-9]+$/)
      // username present (either name, pseudonym, or address fallback)
      expect(c.username.length).toBeGreaterThan(0)
      // likes_count is non-negative integer
      expect(c.likes_count).toBeGreaterThanOrEqual(0)
    }
    console.log(`  adapted ${adapted.length} live comments; first username = ${adapted[0]?.username}`)
  }, 15000)
})
