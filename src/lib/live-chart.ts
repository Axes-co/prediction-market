import type { Event } from '@/types'
import { formatCurrency } from '@/lib/formatters'

// ---------------------------------------------------------------------------
// Live chart helpers — shared between EventLiveSeriesChart and HeroLiveChartPanel
// ---------------------------------------------------------------------------

export interface LivePriceUpdate {
  price: number
  timestamp: number
  symbol: string | null
}

export interface LiveSeriesPriceSnapshot {
  opening_price: number | null
  latest_price: number | null
  closing_price: number | null
  is_event_closed: boolean
}

// ---------------------------------------------------------------------------
// Timestamp / symbol normalization
// ---------------------------------------------------------------------------

export function normalizeTimestamp(value: unknown, fallbackTimestamp = 0) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) {
    return fallbackTimestamp
  }
  return numeric < 1e12 ? numeric * 1000 : numeric
}

function normalizeComparableSymbol(symbol: string) {
  return symbol.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function symbolsAreEquivalent(symbol: string, target: string) {
  const a = normalizeComparableSymbol(symbol)
  const b = normalizeComparableSymbol(target)
  if (!a || !b) {
    return false
  }
  if (a === b) {
    return true
  }
  return a.replace(/(usd|usdt)$/i, '') === b.replace(/(usd|usdt)$/i, '')
}

export function matchesSymbol(symbol: string | null, targetSymbol: string) {
  if (!targetSymbol) {
    return true
  }
  if (!symbol) {
    return false
  }
  return symbolsAreEquivalent(symbol, targetSymbol)
}

export function normalizeSubscriptionSymbol(topic: string, symbol: string) {
  const trimmed = symbol.trim()
  if (!trimmed) {
    return trimmed
  }
  if (topic.trim().toLowerCase() === 'equity_prices') {
    return trimmed.split(/[/-]/)[0]?.trim().toUpperCase() || trimmed.toUpperCase()
  }
  return trimmed.toLowerCase()
}

export function normalizeLiveChartPrice(price: number, topic: string) {
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }
  const digits = topic.trim().toLowerCase() === 'equity_prices' ? 2 : 4
  const factor = 10 ** digits
  return Math.round(price * factor) / factor
}

// ---------------------------------------------------------------------------
// Price formatting
// ---------------------------------------------------------------------------

export function formatUsd(value: number, digits = 2) {
  return formatCurrency(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

export function parseUtcDate(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}Z` : trimmed
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

export function resolveEventEndTimestamp(event: Event) {
  const eventEnd = parseUtcDate(event.end_date)
  const marketEnd = parseUtcDate(event.markets[0]?.end_time)
  if (eventEnd != null && marketEnd != null) {
    return Math.max(eventEnd, marketEnd)
  }
  if (eventEnd != null) {
    return eventEnd
  }
  return marketEnd
}

// ---------------------------------------------------------------------------
// WebSocket payload extraction
// ---------------------------------------------------------------------------

function extractPointsFromArray(
  entries: any[],
  fallbackSymbol: string | null = null,
  fallbackTimestamp = 0,
): LivePriceUpdate[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return []
  }
  const points: LivePriceUpdate[] = []
  for (const point of entries) {
    if (!point || typeof point !== 'object') {
      continue
    }
    const price = Number(point.value ?? point.price ?? point.p)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }
    const rawSymbol = point.symbol ?? point.pair ?? point.asset ?? point.base ?? fallbackSymbol
    const symbol = typeof rawSymbol === 'string' ? rawSymbol : null
    const timestamp = normalizeTimestamp(point.timestamp ?? point.ts ?? point.t, fallbackTimestamp)
    points.push({ price, timestamp, symbol })
  }
  return points
}

export function extractLivePriceUpdates(
  payload: any,
  topic: string,
  symbol: string,
  fallbackTimestamp = 0,
): LivePriceUpdate[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const updates: LivePriceUpdate[] = []
  const candidates: any[] = []
  if (Array.isArray(payload)) {
    candidates.push(...payload)
  }
  else {
    candidates.push(payload)
  }

  if (payload?.payload && typeof payload.payload === 'object') {
    candidates.push(payload.payload)
  }
  if (Array.isArray(payload?.data)) {
    candidates.push(...payload.data)
  }
  else if (payload?.data && typeof payload.data === 'object') {
    candidates.push(payload.data)
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }
    const candidateTopic = candidate.topic ?? candidate?.data?.topic ?? candidate?.payload?.topic ?? candidate?.stream
    if (typeof candidateTopic === 'string' && candidateTopic !== topic) {
      continue
    }

    const rawSymbol = candidate?.data?.symbol ?? candidate?.symbol ?? candidate?.data?.pair
      ?? candidate?.pair ?? candidate?.data?.asset ?? candidate?.asset ?? candidate?.data?.base
      ?? candidate?.base ?? candidate?.payload?.symbol
    const candidateSymbol = typeof rawSymbol === 'string' ? rawSymbol : null

    if (Array.isArray(candidate?.data)) {
      updates.push(...extractPointsFromArray(candidate.data, candidateSymbol, fallbackTimestamp))
    }
    if (Array.isArray(candidate?.payload?.data)) {
      updates.push(...extractPointsFromArray(candidate.payload.data, candidateSymbol, fallbackTimestamp))
    }

    const rawPrice = candidate?.data?.price ?? candidate?.price ?? candidate?.data?.value
      ?? candidate?.value ?? candidate?.data?.p ?? candidate?.p ?? candidate?.payload?.value ?? candidate?.payload?.price
    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price <= 0) {
      continue
    }

    const timestamp = normalizeTimestamp(
      candidate?.data?.timestamp ?? candidate?.timestamp ?? candidate?.data?.ts
      ?? candidate?.ts ?? candidate?.data?.t ?? candidate?.t ?? candidate?.payload?.timestamp,
      fallbackTimestamp,
    )
    updates.push({ price, timestamp, symbol: candidateSymbol })
  }

  const filtered = updates.filter(update => !update.symbol || matchesSymbol(update.symbol, symbol))
  if (!filtered.length) {
    return []
  }

  const sorted = filtered.sort((a, b) => a.timestamp - b.timestamp)
  const deduped: LivePriceUpdate[] = []
  for (const update of sorted) {
    const last = deduped.at(-1)
    if (last && last.timestamp === update.timestamp) {
      deduped[deduped.length - 1] = update
      continue
    }
    deduped.push(update)
  }
  return deduped
}

export function isSnapshotMessage(payload: any) {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const messageType = String(payload?.type ?? '').trim().toLowerCase()
  if (messageType !== 'subscribe') {
    return false
  }
  return Array.isArray(payload?.payload?.data) || Array.isArray(payload?.data)
}
