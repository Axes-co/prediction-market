import { describe, expect, it, vi } from 'vitest'

describe('tagsSync mapping', () => {
  it('maps each gamma tag through mapTags', async () => {
    const { mapTags } = await import('@/lib/gamma/mapper')
    const result = mapTags([
      { id: '1', label: 'Sports', slug: 'sports', forceHide: true, publishedAt: '2023-10-24T22:37:50Z' },
      { id: '439', label: 'AI', slug: 'ai', forceShow: true, isCarousel: true, publishedAt: '2023-11-02T23:08:32Z' },
      { id: '101867', label: 'product marekt fit', slug: 'product-marekt-fit' },
    ])
    expect(result).toHaveLength(3)
    expect(result[0]?.gammaTagId).toBe('1')
    expect(result[0]?.forceHide).toBe(true)
    expect(result[1]?.gammaTagId).toBe('439')
    expect(result[1]?.isCarousel).toBe(true)
    expect(result[1]?.forceShow).toBe(true)
    expect(result[1]?.isMainCategory).toBe(true)
    expect(result[2]?.gammaTagId).toBe('101867')
    expect(result[2]?.forceShow).toBe(false)
    expect(result[2]?.isCarousel).toBe(false)
  })

  it('handles unauthorised requests via the route auth helper', async () => {
    const { isCronAuthorized } = await import('@/lib/auth-cron')
    expect(isCronAuthorized('Bearer wrong', 'expected')).toBe(false)
    expect(isCronAuthorized('Bearer expected', 'expected')).toBe(true)
    expect(isCronAuthorized(null, 'expected')).toBe(false)
  })
})
