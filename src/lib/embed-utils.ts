/**
 * Shared utility functions for embed widgets.
 *
 * These helpers are used by both the server-side embed page and the
 * client-side embed dialogs.  Keeping them in one place avoids the
 * duplication that previously existed across multiple files.
 */

import type { Market, Outcome } from '@/types'

// ---------------------------------------------------------------------------
// Price normalization
// ---------------------------------------------------------------------------

const FALLBACK_PRICE = 0.5

export function clampPrice(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value > 1) return 1
  return value
}

export function normalizeOutcomePrice(outcome: Pick<Outcome, 'buy_price' | 'sell_price'>): number {
  const buy = typeof outcome.buy_price === 'number' ? outcome.buy_price : undefined
  const sell = typeof outcome.sell_price === 'number' ? outcome.sell_price : undefined
  const fallback = buy ?? sell ?? FALLBACK_PRICE
  const mid = ((buy ?? fallback) + (sell ?? fallback)) / 2
  return clampPrice(Number.isFinite(mid) ? mid : FALLBACK_PRICE)
}

export function toPercent(price: number): number {
  return Math.round(clampPrice(price) * 100)
}

// ---------------------------------------------------------------------------
// Market labels
// ---------------------------------------------------------------------------

export function buildMarketLabel(market: Pick<Market, 'short_title' | 'title' | 'slug'>): string {
  return market.short_title?.trim() || market.title || market.slug
}

// ---------------------------------------------------------------------------
// Outcome detection
// ---------------------------------------------------------------------------

const BINARY_LABELS = new Set(['yes', 'no', 'up', 'down'])

/**
 * Returns true when outcomes represent distinct entities (teams, candidates,
 * dates) rather than simple Yes/No or Up/Down.
 */
export function isMultiOutcomeMarket(outcomes: Array<{ label: string }>): boolean {
  if (outcomes.length > 2) return true
  if (outcomes.length <= 1) return false
  return !outcomes.every(o => BINARY_LABELS.has(o.label.toLowerCase()))
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '')
}

export function buildEventPath(event: {
  slug: string
  sports_sport_slug?: string | null
}): string {
  return event.sports_sport_slug
    ? `/sports/${event.sports_sport_slug}/${event.slug}`
    : `/event/${event.slug}`
}

export function buildMarketUrl(
  siteUrl: string,
  eventPath: string,
  utmCampaign: string,
  affiliateCode?: string,
): string {
  const params = new URLSearchParams({
    utm_medium: 'embed',
    utm_campaign: utmCampaign,
  })
  if (affiliateCode) {
    params.set('r', affiliateCode)
  }
  return `${siteUrl}${eventPath}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Boolean param parsing
// ---------------------------------------------------------------------------

export function parseBoolParam(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value !== 'false' && value !== '0'
}

// ---------------------------------------------------------------------------
// Team / outcome color resolution
// ---------------------------------------------------------------------------

const HEX_COLOR_PATTERN = /^#[0-9a-f]{3,8}$/i

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
}
