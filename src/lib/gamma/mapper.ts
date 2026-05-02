import type { GammaEvent, GammaMarket, GammaTag } from './types'
import {
  booleanFlag,
  booleanFlagOrNull,
  decimalString,
  decimalStringOrNull,
  normalizeAddress,
  normalizeHex32,
  parseDate,
  parseJsonStringArray,
  trimToString,
} from './parsing'

export interface MappedEvent {
  slug: string
  title: string
  iconUrl: string | null
  rules: string | null
  /**
   * True when the event is a neg-risk event. Polymarket renamed the field
   * from `enableNegRisk` to `negRisk` over the V2 cutover; the mapper accepts
   * either shape from Gamma so historical events keep mapping correctly.
   */
  enableNegRisk: boolean
  negRiskAugmented: boolean
  negRisk: boolean
  /** Polymarket gamma integer event id; required for `data-api/other?id=` and comment lookups. */
  gammaEventId: number | null
  /** Bytes32 id of the parent neg-risk market (null when event is not neg-risk). */
  negRiskMarketId: string | null
  showAllOutcomes: boolean
  showMarketIcons: boolean
  /** Comment count surfaced on event cards. */
  commentCount: number
  /** Per-event geo-restriction flag for the order panel. */
  restricted: boolean
  /** Whether trading is enabled at the event level. */
  enableOrderBook: boolean | null
  /** Lifecycle flags Gamma exposes (`active`/`closed`/`archived`). */
  gammaActive: boolean | null
  gammaClosed: boolean | null
  gammaArchived: boolean | null
  /** "Tightness" coefficient Polymarket exposes for sort. 0..1. */
  competitive: string | null
  /** Polymarket card-side metrics. */
  volume: string | null
  volume24h: string | null
  volumeWeek: string | null
  volumeMonth: string | null
  volumeYear: string | null
  openInterest: string | null
  liquidity: string | null
  liquidityClob: string | null
  ticker: string | null
  featured: boolean
  featuredOrder: number | null
  startDate: Date | null
  endDate: Date | null
  /** Two distinct timestamps Gamma exposes; we keep both. */
  creationDate: Date | null
  gammaUpdatedAt: Date | null
  createdAt: Date
}

export interface MappedTag {
  /** Polymarket Gamma's tag id (string). Required for cross-reference. */
  gammaTagId: string | null
  slug: string
  name: string
  /** Promote to `tags.is_main_category` so the platform navigation surfaces it. */
  isMainCategory: boolean
  /** Mirrors gamma's `forceShow` — pinned in nav even without active markets. */
  forceShow: boolean
  /** Mirrors gamma's `forceHide` — suppress from default UI even when active. */
  forceHide: boolean
  /** Mirrors gamma's `isCarousel` — eligible for the homepage tag carousel. */
  isCarousel: boolean
  publishedAt: Date | null
}

export interface MappedOutcome {
  outcomeText: string
  outcomeIndex: number
  tokenId: string
  /** Latest snapshot of the outcome's price from Gamma's `outcomePrices` array. */
  price: string | null
}

export interface MappedMarket {
  conditionId: string
  questionId: string
  oracle: string
  creator: string | null
  slug: string
  title: string
  shortTitle: string | null
  question: string | null
  description: string | null
  resolutionSource: string | null
  iconUrl: string | null
  negRisk: boolean
  negRiskOther: boolean
  negRiskRequestId: string | null
  isResolved: boolean
  isActive: boolean
  endTime: Date | null
  createdAt: Date
  updatedAt: Date
  volume: string
  volume24h: string
  /** Polymarket gamma integer market id; useful for cross-referencing API logs. */
  gammaMarketId: number | null
  /** Top-of-book + last-fill snapshots. Polymarket bundles these in the events feed. */
  bestBid: string | null
  bestAsk: string | null
  spread: string | null
  lastTradePrice: string | null
  oneWeekPriceChange: string | null
  oneMonthPriceChange: string | null
  competitive: string | null
  /** Trade-state flags. */
  acceptingOrders: boolean | null
  acceptingOrdersAt: Date | null
  enableOrderBook: boolean | null
  /** Per-market user-config. */
  orderPriceMinTickSize: string | null
  orderMinSize: string | null
  groupItemThreshold: string | null
  /** Per-market liquidity (Polymarket exposes both raw + CLOB-side numbers). */
  liquidity: string | null
  liquidityClob: string | null
  /** Volume across time periods (string variants from Gamma). */
  volumeWeek: string | null
  volumeMonth: string | null
  volumeYear: string | null
  volumeClob: string | null
  volume24hClob: string | null
  volumeWeekClob: string | null
  volumeMonthClob: string | null
  volumeYearClob: string | null
  /** UMA dispute parameters. */
  umaBond: string | null
  umaReward: string | null
  /** Fee model (per-market Polymarket overrides). */
  feeType: string | null
  feeSchedule: Record<string, unknown> | null
  feesEnabled: boolean | null
  /** Per-market geo + featured flags. */
  restricted: boolean | null
  featured: boolean | null
  /** Outcome rows include the price snapshot from Gamma's outcomePrices array. */
  outcomes: MappedOutcome[]
  rawPayload: GammaMarket
}

export class GammaMappingError extends Error {
  constructor(public readonly subject: string, message: string) {
    super(message)
    this.name = 'GammaMappingError'
  }
}

export function mapEvent(gammaEvent: GammaEvent): MappedEvent | null {
  const slug = trimToString(gammaEvent.slug)
  const title = trimToString(gammaEvent.title)
  if (!slug || !title) {
    return null
  }

  // Polymarket cut over from `enableNegRisk` to `negRisk` during the V2
  // migration; some old events still ship the legacy field name. Treat either
  // shape as authoritative so neg-risk classification stays consistent.
  const negRiskFlag = booleanFlag(gammaEvent.negRisk)
  const enableNegRiskFlag = booleanFlag(gammaEvent.enableNegRisk)

  return {
    slug,
    title,
    iconUrl: trimToString(gammaEvent.icon) ?? trimToString(gammaEvent.image),
    rules: trimToString(gammaEvent.description),
    enableNegRisk: enableNegRiskFlag || negRiskFlag,
    negRiskAugmented: booleanFlag(gammaEvent.negRiskAugmented),
    negRisk: negRiskFlag || enableNegRiskFlag,
    gammaEventId: parseInteger(gammaEvent.id),
    negRiskMarketId: normalizeHex32(gammaEvent.negRiskMarketID),
    showAllOutcomes: booleanFlag(gammaEvent.showAllOutcomes),
    showMarketIcons: gammaEvent.showMarketImages !== false,
    commentCount: parseInteger(gammaEvent.commentCount) ?? 0,
    restricted: booleanFlag(gammaEvent.restricted),
    enableOrderBook: booleanFlagOrNull(gammaEvent.enableOrderBook),
    gammaActive: booleanFlagOrNull(gammaEvent.active),
    gammaClosed: booleanFlagOrNull(gammaEvent.closed),
    gammaArchived: booleanFlagOrNull(gammaEvent.archived),
    competitive: decimalStringOrNull(gammaEvent.competitive),
    volume: decimalStringOrNull(gammaEvent.volume),
    volume24h: decimalStringOrNull(gammaEvent.volume24hr),
    volumeWeek: decimalStringOrNull(gammaEvent.volume1wk),
    volumeMonth: decimalStringOrNull(gammaEvent.volume1mo),
    volumeYear: decimalStringOrNull(gammaEvent.volume1yr),
    openInterest: decimalStringOrNull(gammaEvent.openInterest),
    liquidity: decimalStringOrNull(gammaEvent.liquidity),
    liquidityClob: decimalStringOrNull(gammaEvent.liquidityClob),
    ticker: trimToString(gammaEvent.ticker),
    featured: booleanFlag(gammaEvent.featured),
    featuredOrder: parseInteger(gammaEvent.featuredOrder),
    startDate: parseDate(gammaEvent.startDate),
    endDate: parseDate(gammaEvent.endDate),
    creationDate: parseDate(gammaEvent.creationDate),
    gammaUpdatedAt: parseDate(gammaEvent.updatedAt),
    createdAt: parseDate(gammaEvent.createdAt) ?? parseDate(gammaEvent.creationDate) ?? new Date(),
  }
}

/**
 * Coerce gamma's stringly-typed integer fields (id, commentCount, featuredOrder)
 * to a finite number. Returns null on missing/invalid input so callers can
 * distinguish "absent" from "zero".
 */
function parseInteger(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isFinite(numeric) ? numeric : null
}

export function mapTags(gammaTags: GammaTag[] | null | undefined): MappedTag[] {
  if (!Array.isArray(gammaTags)) {
    return []
  }

  const seen = new Map<string, MappedTag>()
  for (const tag of gammaTags) {
    const slug = trimToString(tag.slug)?.toLowerCase()
    const label = trimToString(tag.label)
    if (!slug || !label) {
      continue
    }
    // Gamma's tag id is a numeric string (e.g. "1", "1512"). Carry it as a
    // string to mirror the API shape and dodge JS bigint pitfalls.
    const gammaTagId = tag.id != null ? String(tag.id).trim() || null : null
    const forceShow = booleanFlag(tag.forceShow)
    const forceHide = booleanFlag(tag.forceHide)
    const isCarousel = booleanFlag(tag.isCarousel)
    // `is_main_category` is curated locally (migration
    // `2026_04_30_004_polymarket_header_categories.sql` defines the canonical
    // 14 tags rendered in the platform nav). We DO NOT auto-derive it from
    // gamma's `forceShow` / `isCarousel` flags: polymarket marks ~20 legacy
    // tags as forceShow (djt, biden, airdrops, featured, fed-rates, ...) that
    // we don't want surfaced in our nav. Keeping the local migration as the
    // single source of truth for this flag means admin can curate it without
    // gamma sync silently overwriting their choices on the next cron tick.
    const isMainCategory = false
    const publishedAt = parseDate(tag.publishedAt)
    const existing = seen.get(slug)
    if (existing) {
      // Promote on subsequent observations so any source flagging the tag wins.
      if (gammaTagId && !existing.gammaTagId) {
        existing.gammaTagId = gammaTagId
      }
      if (isMainCategory && !existing.isMainCategory) {
        existing.isMainCategory = true
      }
      if (forceShow && !existing.forceShow) {
        existing.forceShow = true
      }
      if (forceHide && !existing.forceHide) {
        existing.forceHide = true
      }
      if (isCarousel && !existing.isCarousel) {
        existing.isCarousel = true
      }
      if (publishedAt && !existing.publishedAt) {
        existing.publishedAt = publishedAt
      }
      continue
    }
    seen.set(slug, {
      gammaTagId,
      slug,
      name: label.slice(0, 100),
      isMainCategory,
      forceShow,
      forceHide,
      isCarousel,
      publishedAt,
    })
  }
  return [...seen.values()]
}

export function mapMarket(gammaMarket: GammaMarket): MappedMarket {
  const conditionId = normalizeHex32(gammaMarket.conditionId)
  if (!conditionId) {
    throw new GammaMappingError('conditionId', 'market is missing a valid 32-byte conditionId')
  }

  const questionId = normalizeHex32(gammaMarket.questionID)
  if (!questionId) {
    throw new GammaMappingError(conditionId, 'market is missing a valid 32-byte questionID')
  }

  const slug = trimToString(gammaMarket.slug)
  if (!slug) {
    throw new GammaMappingError(conditionId, 'market is missing a slug')
  }

  const title = trimToString(gammaMarket.question)
  if (!title) {
    throw new GammaMappingError(conditionId, 'market is missing a question (title)')
  }

  const oracle = normalizeAddress(gammaMarket.resolvedBy)
  if (!oracle) {
    throw new GammaMappingError(conditionId, 'market is missing a valid resolvedBy address (required for oracle)')
  }

  const outcomeTexts = parseJsonStringArray(gammaMarket.outcomes)
  const tokenIds = parseJsonStringArray(gammaMarket.clobTokenIds)
  if (!outcomeTexts || outcomeTexts.length === 0) {
    throw new GammaMappingError(conditionId, 'market is missing outcomes')
  }
  if (!tokenIds || tokenIds.length !== outcomeTexts.length) {
    throw new GammaMappingError(conditionId, 'market clobTokenIds length does not match outcomes length')
  }
  for (let index = 0; index < tokenIds.length; index += 1) {
    const tokenId = trimToString(tokenIds[index])
    if (!tokenId) {
      throw new GammaMappingError(conditionId, `outcome ${index} has an empty token id`)
    }
    tokenIds[index] = tokenId
  }

  // `outcomePrices` is a JSON string array of decimal strings parallel to
  // `outcomes`. When present, each entry is the live mid-price snapshot for
  // that outcome — Polymarket bundles these with the events feed so cards can
  // render probabilities without a CLOB round-trip per render.
  const outcomePrices = parseJsonStringArray(gammaMarket.outcomePrices)
  const outcomePricesAligned = outcomePrices && outcomePrices.length === outcomeTexts.length
    ? outcomePrices
    : null

  const isResolved = booleanFlag(gammaMarket.closed) || booleanFlag(gammaMarket.archived)
  const isActive = booleanFlag(gammaMarket.active) && !isResolved
  const createdAt = parseDate(gammaMarket.createdAt) ?? new Date()
  const updatedAt = parseDate(gammaMarket.updatedAt) ?? createdAt

  const outcomes: MappedOutcome[] = outcomeTexts.map((text, index) => ({
    outcomeText: text,
    outcomeIndex: index,
    tokenId: tokenIds[index],
    price: outcomePricesAligned ? decimalStringOrNull(outcomePricesAligned[index]) : null,
  }))

  return {
    conditionId,
    questionId,
    oracle,
    creator: normalizeAddress(gammaMarket.submitted_by) ?? normalizeAddress(gammaMarket.marketMakerAddress),
    slug,
    title,
    shortTitle: trimToString(gammaMarket.groupItemTitle),
    question: trimToString(gammaMarket.question),
    description: trimToString(gammaMarket.description),
    resolutionSource: trimToString(gammaMarket.resolutionSource),
    iconUrl: trimToString(gammaMarket.icon) ?? trimToString(gammaMarket.image),
    negRisk: booleanFlag(gammaMarket.negRisk),
    negRiskOther: booleanFlag(gammaMarket.negRiskOther),
    negRiskRequestId: normalizeHex32(gammaMarket.negRiskRequestID),
    isResolved,
    isActive,
    endTime: parseDate(gammaMarket.endDate),
    createdAt,
    updatedAt,
    volume: decimalString(gammaMarket.volumeClob ?? gammaMarket.volume),
    volume24h: decimalString(gammaMarket.volume24hrClob ?? gammaMarket.volume24hr),
    gammaMarketId: parseInteger(gammaMarket.id),
    bestBid: decimalStringOrNull(gammaMarket.bestBid),
    bestAsk: decimalStringOrNull(gammaMarket.bestAsk),
    spread: decimalStringOrNull(gammaMarket.spread),
    lastTradePrice: decimalStringOrNull(gammaMarket.lastTradePrice),
    oneWeekPriceChange: decimalStringOrNull(gammaMarket.oneWeekPriceChange),
    oneMonthPriceChange: decimalStringOrNull(gammaMarket.oneMonthPriceChange),
    competitive: decimalStringOrNull(gammaMarket.competitive),
    acceptingOrders: booleanFlagOrNull(gammaMarket.acceptingOrders),
    acceptingOrdersAt: parseDate(gammaMarket.acceptingOrdersTimestamp),
    enableOrderBook: booleanFlagOrNull(gammaMarket.enableOrderBook),
    orderPriceMinTickSize: decimalStringOrNull(gammaMarket.orderPriceMinTickSize),
    orderMinSize: decimalStringOrNull(gammaMarket.orderMinSize),
    groupItemThreshold: decimalStringOrNull(gammaMarket.groupItemThreshold),
    liquidity: decimalStringOrNull(gammaMarket.liquidity ?? gammaMarket.liquidityNum),
    liquidityClob: decimalStringOrNull(gammaMarket.liquidityClob),
    volumeWeek: decimalStringOrNull(gammaMarket.volume1wk),
    volumeMonth: decimalStringOrNull(gammaMarket.volume1mo),
    volumeYear: decimalStringOrNull(gammaMarket.volume1yr),
    volumeClob: decimalStringOrNull(gammaMarket.volumeClob),
    volume24hClob: decimalStringOrNull(gammaMarket.volume24hrClob),
    volumeWeekClob: decimalStringOrNull(gammaMarket.volume1wkClob),
    volumeMonthClob: decimalStringOrNull(gammaMarket.volume1moClob),
    volumeYearClob: decimalStringOrNull(gammaMarket.volume1yrClob),
    umaBond: decimalStringOrNull(gammaMarket.umaBond),
    umaReward: decimalStringOrNull(gammaMarket.umaReward),
    feeType: trimToString(gammaMarket.feeType),
    feeSchedule: gammaMarket.feeSchedule ?? null,
    feesEnabled: booleanFlagOrNull(gammaMarket.feesEnabled),
    restricted: booleanFlagOrNull(gammaMarket.restricted),
    featured: booleanFlagOrNull(gammaMarket.featured),
    outcomes,
    rawPayload: gammaMarket,
  }
}
