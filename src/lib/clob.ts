import type { OrderBookSummaryResponse } from '@/types/EventCardTypes'

const CLOB_BASE_URL = process.env.CLOB_URL
const MAX_LIMIT_PRICE = 99.9
const PRICE_EPSILON = 1e-8
const CLOB_FETCH_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 1500 : 4000

/**
 * Sides accepted by the Polymarket CLOB price endpoints (`/prices`,
 * `/last-trades-prices`). The contract requires one entry per (token, side)
 * pair: BUY returns the best ask, SELL returns the best bid. Kuest's CLOB
 * follows the same Polymarket spec, so this shape is universal.
 */
export const CLOB_BOOK_SIDES = ['BUY', 'SELL'] as const

export type ClobBookSide = (typeof CLOB_BOOK_SIDES)[number]

/**
 * Build the sided body for `/prices` and `/last-trades-prices`. Pass the
 * unique token ids; the helper expands each into BUY + SELL entries.
 */
export function buildClobPriceQueryEntries(tokenIds: string[]): { token_id: string, side: ClobBookSide }[] {
  return tokenIds.flatMap(tokenId => CLOB_BOOK_SIDES.map(side => ({ token_id: tokenId, side })))
}

export function getClobBaseUrl() {
  if (!CLOB_BASE_URL) {
    throw new Error('CLOB URL is not configured.')
  }

  return CLOB_BASE_URL
}

export async function fetchClobJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getClobBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(CLOB_FETCH_TIMEOUT_MS),
    body: JSON.stringify(body),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${text}`)
  }

  try {
    return JSON.parse(text) as T
  }
  catch (error) {
    console.error(`Failed to parse response from ${path}`, error)
    throw new Error(`Failed to parse response from ${path}`)
  }
}

export async function fetchOrderBookSummary(tokenId: string): Promise<OrderBookSummaryResponse> {
  const payload = [{ token_id: tokenId }]
  const orderBooks = await fetchClobJson<Array<OrderBookSummaryResponse & { asset_id?: string, token_id?: string }>>('/books', payload)

  const entry = Array.isArray(orderBooks)
    ? orderBooks.find(item => item && (item.asset_id === tokenId || item.token_id === tokenId))
    : null

  if (!entry) {
    return {}
  }

  return {
    bids: entry.bids ?? [],
    asks: entry.asks ?? [],
  }
}

export function getRoundedCents(rawPrice: number, side: 'ask' | 'bid') {
  const cents = rawPrice * 100
  if (!Number.isFinite(cents)) {
    return 0
  }

  const scaled = cents * 10
  const roundedScaled = side === 'bid'
    ? Math.floor(scaled + PRICE_EPSILON)
    : Math.ceil(scaled - PRICE_EPSILON)

  const normalized = Math.max(0, Math.min(roundedScaled / 10, MAX_LIMIT_PRICE))
  return Number(normalized.toFixed(1))
}
