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
        gammaTagId: null,
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
        gammaTagId: null,
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
      { id: '101', slug: 'politics', label: 'Politics', forceShow: true },
      { id: '102', slug: 'sports', label: 'Sports', isCarousel: true },
      { id: '103', slug: 'finance', label: 'Finance' },
    ]
    expect(mapTags(tags)).toEqual([
      {
        gammaTagId: '101',
        slug: 'politics',
        name: 'Politics',
        isMainCategory: true,
        forceShow: true,
        forceHide: false,
        isCarousel: false,
        publishedAt: null,
      },
      {
        gammaTagId: '102',
        slug: 'sports',
        name: 'Sports',
        isMainCategory: true,
        forceShow: false,
        forceHide: false,
        isCarousel: true,
        publishedAt: null,
      },
      {
        gammaTagId: '103',
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
      { id: '12', slug: 'crypto', label: 'Crypto', isCarousel: true },
    ]
    expect(mapTags(tags)).toEqual([
      {
        gammaTagId: '12',
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
      { outcomeText: 'Yes', outcomeIndex: 0, tokenId: '111', price: null },
      { outcomeText: 'No', outcomeIndex: 1, tokenId: '222', price: null },
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

  it('captures the outcomePrices snapshot per outcome', () => {
    const result = mapMarket(buildMarket({ outcomePrices: '["0.0105", "0.9895"]' }))
    expect(result.outcomes[0].price).toBe('0.0105')
    expect(result.outcomes[1].price).toBe('0.9895')
  })

  it('drops outcomePrices when length disagrees with outcomes', () => {
    const result = mapMarket(buildMarket({ outcomePrices: '["0.5"]' }))
    expect(result.outcomes[0].price).toBeNull()
    expect(result.outcomes[1].price).toBeNull()
  })

  it('extracts top-of-book + last-fill snapshots', () => {
    const result = mapMarket(buildMarket({
      bestBid: 0.013,
      bestAsk: 0.014,
      spread: 0.001,
      lastTradePrice: 0.014,
      oneWeekPriceChange: 0.001,
      oneMonthPriceChange: -0.0015,
      competitive: 0.8067,
    }))
    expect(result.bestBid).toBe('0.013')
    expect(result.bestAsk).toBe('0.014')
    expect(result.spread).toBe('0.001')
    expect(result.lastTradePrice).toBe('0.014')
    expect(result.oneWeekPriceChange).toBe('0.001')
    expect(result.oneMonthPriceChange).toBe('-0.0015')
    expect(result.competitive).toBe('0.8067')
  })

  it('extracts trade-state flags and order-config', () => {
    const result = mapMarket(buildMarket({
      acceptingOrders: true,
      acceptingOrdersTimestamp: '2025-07-11T18:35:40Z',
      enableOrderBook: true,
      orderPriceMinTickSize: 0.001,
      orderMinSize: 5,
      groupItemThreshold: '5',
    }))
    expect(result.acceptingOrders).toBe(true)
    expect(result.acceptingOrdersAt?.toISOString()).toBe('2025-07-11T18:35:40.000Z')
    expect(result.enableOrderBook).toBe(true)
    expect(result.orderPriceMinTickSize).toBe('0.001')
    expect(result.orderMinSize).toBe('5')
    expect(result.groupItemThreshold).toBe('5')
  })

  it('extracts UMA + fee config', () => {
    const result = mapMarket(buildMarket({
      umaBond: '25000',
      umaReward: '10',
      feeType: 'politics_fees',
      feeSchedule: { exponent: 1, rate: 0.04, takerOnly: true },
      feesEnabled: true,
    }))
    expect(result.umaBond).toBe('25000')
    expect(result.umaReward).toBe('10')
    expect(result.feeType).toBe('politics_fees')
    expect(result.feeSchedule).toEqual({ exponent: 1, rate: 0.04, takerOnly: true })
    expect(result.feesEnabled).toBe(true)
  })

  it('extracts the full volume + liquidity matrix', () => {
    const result = mapMarket(buildMarket({
      volume1wk: '475948.30',
      volume1mo: '6027871.91',
      volume1yr: '19868651.35',
      volume1wkClob: '475948.30',
      volume1moClob: '6027871.91',
      volume1yrClob: '19868651.35',
      liquidity: '247470.70',
      liquidityClob: '247470.70',
    }))
    expect(result.volumeWeek).toBe('475948.3')
    expect(result.volumeMonth).toBe('6027871.91')
    expect(result.volumeYear).toBe('19868651.35')
    expect(result.volumeWeekClob).toBe('475948.3')
    expect(result.volumeMonthClob).toBe('6027871.91')
    expect(result.volumeYearClob).toBe('19868651.35')
    expect(result.liquidity).toBe('247470.7')
    expect(result.liquidityClob).toBe('247470.7')
  })

  it('returns null for unsourced numeric fields rather than zero', () => {
    const result = mapMarket(buildMarket())
    expect(result.bestBid).toBeNull()
    expect(result.lastTradePrice).toBeNull()
    expect(result.umaBond).toBeNull()
    expect(result.spread).toBeNull()
  })
})

describe('mapEvent (expanded gamma parity)', () => {
  it('treats negRisk + enableNegRisk as equivalent (Polymarket renamed the field)', () => {
    const negOnly = mapEvent({ slug: 'a', title: 'b', negRisk: true })!
    expect(negOnly.negRisk).toBe(true)
    expect(negOnly.enableNegRisk).toBe(true)

    const enableOnly = mapEvent({ slug: 'a', title: 'b', enableNegRisk: true })!
    expect(enableOnly.negRisk).toBe(true)
    expect(enableOnly.enableNegRisk).toBe(true)
  })

  it('captures the volume / openInterest / competitive matrix', () => {
    const result = mapEvent({
      slug: 'a',
      title: 'b',
      volume: 1113877780.99,
      volume24hr: 1589979.79,
      volume1wk: 21993258.93,
      volume1mo: 175481992.35,
      volume1yr: 1113877780.99,
      openInterest: 17138217.88,
      competitive: 0.948,
      liquidity: 47925001.62,
      liquidityClob: 47925001.62,
    })!
    expect(result.volume).toBe('1113877780.99')
    expect(result.volume24h).toBe('1589979.79')
    expect(result.volumeWeek).toBe('21993258.93')
    expect(result.volumeMonth).toBe('175481992.35')
    expect(result.volumeYear).toBe('1113877780.99')
    expect(result.openInterest).toBe('17138217.88')
    expect(result.competitive).toBe('0.948')
    expect(result.liquidity).toBe('47925001.62')
    expect(result.liquidityClob).toBe('47925001.62')
  })

  it('captures lifecycle + ticker + order-book flags', () => {
    const result = mapEvent({
      slug: 'a',
      title: 'b',
      ticker: 'democratic-presidential-nominee-2028',
      enableOrderBook: true,
      active: true,
      closed: false,
      archived: false,
      creationDate: '2025-07-03T20:36:57.824243Z',
      updatedAt: '2026-04-30T10:45:12.501843Z',
    })!
    expect(result.ticker).toBe('democratic-presidential-nominee-2028')
    expect(result.enableOrderBook).toBe(true)
    expect(result.gammaActive).toBe(true)
    expect(result.gammaClosed).toBe(false)
    expect(result.gammaArchived).toBe(false)
    expect(result.creationDate?.toISOString()).toBe('2025-07-03T20:36:57.824Z')
    expect(result.gammaUpdatedAt?.toISOString()).toBe('2026-04-30T10:45:12.501Z')
  })
})
