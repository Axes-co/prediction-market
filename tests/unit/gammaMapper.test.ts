import { describe, expect, it } from 'vitest'
import { GammaMappingError, mapEvent, mapMarket, mapTags } from '@/lib/gamma/mapper'
import type { GammaEvent, GammaMarket, GammaTag } from '@/lib/gamma/types'

const VALID_CONDITION_ID = `0x${'a'.repeat(64)}`
const VALID_QUESTION_ID = `0x${'b'.repeat(64)}`
const VALID_RESOLVED_BY = '0x6A9D222616C90FcA5754cd1333cFD9b7fb6a4F74'
const VALID_SUBMITTED_BY = '0x91430CaD2d3975766499717fA0D66A78D814E5c5'

function buildMarket(overrides: Partial<GammaMarket> = {}): GammaMarket {
  return {
    id: '1',
    conditionId: VALID_CONDITION_ID,
    questionID: VALID_QUESTION_ID,
    question: 'Will it rain tomorrow?',
    description: 'Resolves YES if it rains in NYC.',
    slug: 'will-it-rain',
    outcomes: '["Yes", "No"]',
    clobTokenIds: '["111", "222"]',
    image: 'https://example.test/img.png',
    icon: 'https://example.test/icon.png',
    closed: false,
    active: true,
    archived: false,
    negRisk: false,
    resolvedBy: VALID_RESOLVED_BY,
    submitted_by: VALID_SUBMITTED_BY,
    resolutionSource: 'NWS',
    volume: '1000.5',
    volume24hr: '50.25',
    volumeClob: '900.0',
    volume24hrClob: '40.0',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    endDate: '2027-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('mapEvent', () => {
  it('returns null when slug is missing', () => {
    expect(mapEvent({ title: 'X' } as GammaEvent)).toBeNull()
  })

  it('returns null when title is missing', () => {
    expect(mapEvent({ slug: 'x' } as GammaEvent)).toBeNull()
  })

  it('maps required and optional fields', () => {
    const result = mapEvent({
      slug: ' will-it-rain ',
      title: 'Weather event',
      description: 'About weather',
      image: 'https://example.test/img.png',
      icon: 'https://example.test/icon.png',
      enableNegRisk: true,
      negRiskAugmented: false,
      negRisk: false,
      showMarketImages: false,
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      createdAt: '2025-12-01T00:00:00Z',
    })

    expect(result).not.toBeNull()
    expect(result!.slug).toBe('will-it-rain')
    expect(result!.title).toBe('Weather event')
    expect(result!.iconUrl).toBe('https://example.test/icon.png')
    expect(result!.rules).toBe('About weather')
    expect(result!.enableNegRisk).toBe(true)
    expect(result!.negRiskAugmented).toBe(false)
    expect(result!.showMarketIcons).toBe(false)
    expect(result!.startDate?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(result!.endDate?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(result!.createdAt.toISOString()).toBe('2025-12-01T00:00:00.000Z')
  })

  it('falls back to image when icon is missing', () => {
    const result = mapEvent({
      slug: 'a',
      title: 'b',
      icon: null,
      image: 'https://example.test/img.png',
    })
    expect(result!.iconUrl).toBe('https://example.test/img.png')
  })

  it('uses current timestamp when createdAt is missing', () => {
    const before = Date.now()
    const result = mapEvent({ slug: 'a', title: 'b' })
    const after = Date.now()
    expect(result!.createdAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(result!.createdAt.getTime()).toBeLessThanOrEqual(after)
  })
})

describe('mapTags', () => {
  it('returns empty array when input is null', () => {
    expect(mapTags(null)).toEqual([])
  })

  it('skips tags with missing slug or label', () => {
    const tags: GammaTag[] = [
      { slug: '', label: 'Foo' },
      { slug: 'bar', label: '' },
      { slug: 'baz', label: 'Baz' },
    ]
    expect(mapTags(tags)).toEqual([
      {
        slug: 'baz',
        name: 'Baz',
        isMainCategory: false,
        forceShow: false,
        forceHide: false,
        isCarousel: false,
        publishedAt: null,
      },
    ])
  })

  it('lowercases slug and dedupes', () => {
    const tags: GammaTag[] = [
      { slug: 'Crypto', label: 'Crypto' },
      { slug: 'crypto', label: 'Crypto-2' },
    ]
    expect(mapTags(tags)).toEqual([
      {
        slug: 'crypto',
        name: 'Crypto',
        isMainCategory: false,
        forceShow: false,
        forceHide: false,
        isCarousel: false,
        publishedAt: null,
      },
    ])
  })

  it('promotes tags flagged as forceShow or isCarousel to main category', () => {
    const tags: GammaTag[] = [
      { slug: 'politics', label: 'Politics', forceShow: true },
      { slug: 'sports', label: 'Sports', isCarousel: true },
      { slug: 'finance', label: 'Finance' },
    ]
    expect(mapTags(tags)).toEqual([
      {
        slug: 'politics',
        name: 'Politics',
        isMainCategory: true,
        forceShow: true,
        forceHide: false,
        isCarousel: false,
        publishedAt: null,
      },
      {
        slug: 'sports',
        name: 'Sports',
        isMainCategory: true,
        forceShow: false,
        forceHide: false,
        isCarousel: true,
        publishedAt: null,
      },
      {
        slug: 'finance',
        name: 'Finance',
        isMainCategory: false,
        forceShow: false,
        forceHide: false,
        isCarousel: false,
        publishedAt: null,
      },
    ])
  })

  it('upgrades a tag to main category if a later occurrence flags it', () => {
    const tags: GammaTag[] = [
      { slug: 'crypto', label: 'Crypto' },
      { slug: 'crypto', label: 'Crypto', isCarousel: true },
    ]
    expect(mapTags(tags)).toEqual([
      {
        slug: 'crypto',
        name: 'Crypto',
        isMainCategory: true,
        forceShow: false,
        forceHide: false,
        isCarousel: true,
        publishedAt: null,
      },
    ])
  })

  it('preserves forceHide and publishedAt when present', () => {
    const tags: GammaTag[] = [
      { slug: 'archive', label: 'Archive', forceHide: true, publishedAt: '2025-01-15T12:00:00Z' },
    ]
    const result = mapTags(tags)
    expect(result).toHaveLength(1)
    expect(result[0]?.forceHide).toBe(true)
    expect(result[0]?.publishedAt?.toISOString()).toBe('2025-01-15T12:00:00.000Z')
  })

  it('truncates label to 100 chars', () => {
    const longLabel = 'x'.repeat(150)
    const result = mapTags([{ slug: 'a', label: longLabel }])
    expect(result[0].name).toHaveLength(100)
  })
})

describe('mapMarket', () => {
  it('produces a fully-mapped market with valid input', () => {
    const result = mapMarket(buildMarket())

    expect(result.conditionId).toBe(VALID_CONDITION_ID)
    expect(result.questionId).toBe(VALID_QUESTION_ID)
    expect(result.oracle).toBe(VALID_RESOLVED_BY.toLowerCase())
    expect(result.creator).toBe(VALID_SUBMITTED_BY.toLowerCase())
    expect(result.slug).toBe('will-it-rain')
    expect(result.title).toBe('Will it rain tomorrow?')
    expect(result.outcomes).toEqual([
      { outcomeText: 'Yes', outcomeIndex: 0, tokenId: '111' },
      { outcomeText: 'No', outcomeIndex: 1, tokenId: '222' },
    ])
    expect(result.volume).toBe('900')
    expect(result.volume24h).toBe('40')
    expect(result.isActive).toBe(true)
    expect(result.isResolved).toBe(false)
  })

  it('falls back to volume when volumeClob is missing', () => {
    const result = mapMarket(buildMarket({ volumeClob: null, volume24hrClob: null }))
    expect(result.volume).toBe('1000.5')
    expect(result.volume24h).toBe('50.25')
  })

  it('marks resolved when closed is true', () => {
    const result = mapMarket(buildMarket({ closed: true, active: false }))
    expect(result.isResolved).toBe(true)
    expect(result.isActive).toBe(false)
  })

  it('marks inactive when active is true but closed is also true', () => {
    const result = mapMarket(buildMarket({ closed: true, active: true }))
    expect(result.isResolved).toBe(true)
    expect(result.isActive).toBe(false)
  })

  it('throws when conditionId is missing', () => {
    expect(() => mapMarket(buildMarket({ conditionId: null }))).toThrow(GammaMappingError)
  })

  it('throws when conditionId is not a 32-byte hex string', () => {
    expect(() => mapMarket(buildMarket({ conditionId: '0xabc' }))).toThrow(/conditionId/)
  })

  it('throws when questionID is missing', () => {
    expect(() => mapMarket(buildMarket({ questionID: null }))).toThrow(/questionID/)
  })

  it('throws when slug is missing', () => {
    expect(() => mapMarket(buildMarket({ slug: '' }))).toThrow(/slug/)
  })

  it('throws when question is missing', () => {
    expect(() => mapMarket(buildMarket({ question: '' }))).toThrow(/title/)
  })

  it('throws when resolvedBy is missing (no fabricated oracle)', () => {
    expect(() => mapMarket(buildMarket({ resolvedBy: null }))).toThrow(/resolvedBy/)
  })

  it('throws when resolvedBy is not a valid address', () => {
    expect(() => mapMarket(buildMarket({ resolvedBy: 'nope' }))).toThrow(/resolvedBy/)
  })

  it('throws when outcomes is unparseable', () => {
    expect(() => mapMarket(buildMarket({ outcomes: 'not-json' }))).toThrow(/outcomes/)
  })

  it('throws when clobTokenIds length differs from outcomes', () => {
    expect(() => mapMarket(buildMarket({ clobTokenIds: '["only-one"]' }))).toThrow(/length/)
  })

  it('throws when a token id is empty string', () => {
    expect(() => mapMarket(buildMarket({ clobTokenIds: '["111", ""]' }))).toThrow(/token id/)
  })

  it('returns null creator when both submitted_by and marketMakerAddress are absent', () => {
    const result = mapMarket(buildMarket({ submitted_by: null, marketMakerAddress: '' }))
    expect(result.creator).toBeNull()
  })

  it('preserves the raw payload for downstream metadata storage', () => {
    const market = buildMarket()
    const result = mapMarket(market)
    expect(result.rawPayload).toBe(market)
  })
})
