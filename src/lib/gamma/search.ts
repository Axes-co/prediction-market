import type { GammaEvent, GammaMarket } from './types'
import { GammaMappingError, mapEvent, mapMarket, mapTags } from './mapper'
import { linkEventTags, upsertEvent, upsertMarketsForEvent } from './repository'

// On-demand gamma sync triggered by the search bar. When a user types a
// query, the /api/events route calls this first so events that exist on
// polymarket.com but haven't been pulled by the periodic gamma cron yet
// land in our DB before the local search runs. The result is that the
// search bar effectively sees Polymarket's full ~7.5k active catalog,
// not just whatever subset the cron has cycled through.
//
// Why we reuse the cron's mapper/upserter (mapEvent / upsertEvent /
// linkEventTags / upsertMarketsForEvent) instead of writing a search-
// specific path: any divergence between sync paths produces drift in
// the DB shape that's painful to debug later. Same upsert = same
// invariants, same cache-tag fan-out.

const GAMMA_PUBLIC_SEARCH_URL = 'https://gamma-api.polymarket.com/public-search'
const SEARCH_LIMIT_PER_TYPE = '10'
const SEARCH_FETCH_TIMEOUT_MS = 4_000
const SEARCH_PERSIST_CONCURRENCY = 4

interface PublicSearchResponse {
  events?: GammaEvent[]
}

interface PersistResult {
  inserted: number
  updated: number
  skipped: number
}

function collectValidMarkets(markets: GammaMarket[] | null | undefined) {
  if (!Array.isArray(markets) || markets.length === 0) {
    return []
  }
  const valid = []
  for (const market of markets) {
    try {
      valid.push(mapMarket(market))
    }
    catch (error) {
      if (!(error instanceof GammaMappingError)) {
        throw error
      }
    }
  }
  return valid
}

async function persistEvent(gammaEvent: GammaEvent): Promise<'inserted' | 'updated' | 'skipped'> {
  const mappedEvent = mapEvent(gammaEvent)
  if (!mappedEvent) {
    return 'skipped'
  }
  const validMarkets = collectValidMarkets(gammaEvent.markets)
  if (validMarkets.length === 0) {
    return 'skipped'
  }

  const eventResult = await upsertEvent(mappedEvent)
  await linkEventTags(eventResult.eventId, mapTags(gammaEvent.tags))
  await upsertMarketsForEvent(validMarkets, eventResult.eventId)

  if (eventResult.inserted) {
    return 'inserted'
  }
  if (eventResult.changed) {
    return 'updated'
  }
  return 'skipped'
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  let cursor = 0
  async function next(): Promise<void> {
    const index = cursor
    cursor += 1
    if (index >= items.length) {
      return
    }
    results[index] = await worker(items[index]!)
    await next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()))
  return results
}

export async function searchAndPersistFromPolymarket(query: string): Promise<PersistResult> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { inserted: 0, updated: 0, skipped: 0 }
  }

  const url = new URL(GAMMA_PUBLIC_SEARCH_URL)
  url.searchParams.set('q', trimmed)
  url.searchParams.set('events_status', 'active')
  url.searchParams.set('limit_per_type', SEARCH_LIMIT_PER_TYPE)

  let payload: PublicSearchResponse
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(SEARCH_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return { inserted: 0, updated: 0, skipped: 0 }
    }
    payload = await response.json() as PublicSearchResponse
  }
  catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('searchAndPersistFromPolymarket: fetch failed.', error)
    }
    return { inserted: 0, updated: 0, skipped: 0 }
  }

  const events = Array.isArray(payload.events) ? payload.events : []
  if (events.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 }
  }

  let inserted = 0
  let updated = 0
  let skipped = 0

  const outcomes = await runWithConcurrency(events, SEARCH_PERSIST_CONCURRENCY, async (event) => {
    try {
      return await persistEvent(event)
    }
    catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('searchAndPersistFromPolymarket: persist failed.', { slug: event.slug, error })
      }
      return 'skipped' as const
    }
  })

  for (const outcome of outcomes) {
    if (outcome === 'inserted') {
      inserted += 1
    }
    else if (outcome === 'updated') {
      updated += 1
    }
    else {
      skipped += 1
    }
  }

  return { inserted, updated, skipped }
}
