import type { GammaEvent, GammaMarket, GammaTag } from './types'
import {
  booleanFlag,
  decimalString,
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
  liquidityClob: string | null
  featured: boolean
  featuredOrder: number | null
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
}

export interface MappedTag {
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

  return {
    slug,
    title,
    iconUrl: trimToString(gammaEvent.icon) ?? trimToString(gammaEvent.image),
    rules: trimToString(gammaEvent.description),
    enableNegRisk: booleanFlag(gammaEvent.enableNegRisk),
    negRiskAugmented: booleanFlag(gammaEvent.negRiskAugmented),
    negRisk: booleanFlag(gammaEvent.negRisk),
    gammaEventId: parseInteger(gammaEvent.id),
    negRiskMarketId: normalizeHex32(gammaEvent.negRiskMarketID),
    showAllOutcomes: booleanFlag(gammaEvent.showAllOutcomes),
    showMarketIcons: gammaEvent.showMarketImages !== false,
    commentCount: parseInteger(gammaEvent.commentCount) ?? 0,
    restricted: booleanFlag(gammaEvent.restricted),
    liquidityClob: decimalString(gammaEvent.liquidityClob ?? gammaEvent.liquidity),
    featured: booleanFlag(gammaEvent.featured),
    featuredOrder: parseInteger(gammaEvent.featuredOrder),
    startDate: parseDate(gammaEvent.startDate),
    endDate: parseDate(gammaEvent.endDate),
    createdAt: parseDate(gammaEvent.createdAt) ?? new Date(),
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
    const forceShow = booleanFlag(tag.forceShow)
    const forceHide = booleanFlag(tag.forceHide)
    const isCarousel = booleanFlag(tag.isCarousel)
    const isMainCategory = forceShow || isCarousel
    const publishedAt = parseDate(tag.publishedAt)
    const existing = seen.get(slug)
    if (existing) {
      // Promote on subsequent observations so any source flagging the tag wins.
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

  const isResolved = booleanFlag(gammaMarket.closed) || booleanFlag(gammaMarket.archived)
  const isActive = booleanFlag(gammaMarket.active) && !isResolved
  const createdAt = parseDate(gammaMarket.createdAt) ?? new Date()
  const updatedAt = parseDate(gammaMarket.updatedAt) ?? createdAt

  const outcomes: MappedOutcome[] = outcomeTexts.map((text, index) => ({
    outcomeText: text,
    outcomeIndex: index,
    tokenId: tokenIds[index],
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
    outcomes,
    rawPayload: gammaMarket,
  }
}
