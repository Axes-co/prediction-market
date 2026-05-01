import type { GammaEventOrder, GammaEventState } from './client'
import type { GammaCursorMap } from './lock'
import type { MappedMarket } from './mapper'
import type { GammaEvent, GammaMarket } from './types'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { AllowedMarketCreatorRepository } from '@/lib/db/queries/allowed-market-creators'
import { GammaClient } from './client'
import { acquireGammaSyncLock, loadGammaSyncCursors, releaseGammaSyncLock } from './lock'
import { GammaMappingError, mapEvent, mapMarket, mapTags } from './mapper'
import { linkEventTags, upsertEvent, upsertMarketsForEvent } from './repository'

export interface GammaSyncOptions {
  pageSize?: number
  startCursor?: string | null
  timeLimitMs?: number
  maxPagesPerSource?: number
  sourceUrls?: string[]
}

export interface GammaSyncError {
  scope: 'event' | 'market'
  id: string
  source?: string
  message: string
}

export interface GammaSourceResult {
  sourceUrl: string
  displayName: string
  lane: string
  pagesFetched: number
  eventsSeen: number
  eventsSkippedNoMarkets: number
  eventsInserted: number
  eventsUpdated: number
  marketsInserted: number
  marketsUpdated: number
  marketsSkipped: number
  cursor: string | null
  timeLimitReached: boolean
}

export interface GammaSyncResult {
  sources: GammaSourceResult[]
  totalEventsInserted: number
  totalEventsUpdated: number
  totalMarketsInserted: number
  totalMarketsUpdated: number
  totalMarketsSkipped: number
  cacheTagsRevalidated: number
  errors: GammaSyncError[]
  timeLimitReached: boolean
  lockBusy: boolean
}

// Per-invocation work budget. Must stay below the route's maxDuration so the
// `releaseGammaSyncLock('completed')` call in `runWhileLocked` always runs;
// otherwise the lambda gets killed mid-write and the lock leaks for 15 min.
// route.ts sets maxDuration=600 (Pro plan), buffer is ~100s for finally + flush.
const DEFAULT_TIME_LIMIT_MS = 500_000
const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com'

interface GammaSyncLane {
  id: string
  displayName: string
  order: GammaEventOrder
  pageSize?: number
  state: GammaEventState
  maxPagesPerSource?: number
  persistCursor: boolean
}

const DEFAULT_GAMMA_SYNC_LANES: GammaSyncLane[] = [
  {
    id: 'active-volume24hr',
    displayName: 'active volume24hr',
    order: 'volume24hr',
    pageSize: 100,
    state: 'active',
    maxPagesPerSource: 1,
    persistCursor: false,
  },
  {
    id: 'active-createdAt',
    displayName: 'active createdAt',
    order: 'createdAt',
    pageSize: 100,
    state: 'active',
    maxPagesPerSource: 1,
    persistCursor: false,
  },
  {
    id: 'all-volume',
    displayName: 'all volume',
    order: 'volume',
    // 500-event pages combined with sports events that carry 40+ markets
    // each blew past the 300s function timeout, leaking the lock for the
    // next 15 minutes (until STALE_AFTER_MS in lock.ts). 100 keeps each
    // page bounded and matches the per-tick work the active lanes do.
    pageSize: 100,
    state: 'all',
    persistCursor: true,
  },
]

export async function runGammaSync(options: GammaSyncOptions = {}): Promise<GammaSyncResult> {
  const startedAt = Date.now()
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS

  const result: GammaSyncResult = {
    sources: [],
    totalEventsInserted: 0,
    totalEventsUpdated: 0,
    totalMarketsInserted: 0,
    totalMarketsUpdated: 0,
    totalMarketsSkipped: 0,
    cacheTagsRevalidated: 0,
    errors: [],
    timeLimitReached: false,
    lockBusy: false,
  }

  const acquired = await acquireGammaSyncLock()
  if (!acquired) {
    result.lockBusy = true
    return result
  }

  try {
    const [sources, persistedCursors] = await Promise.all([
      resolveGammaSources(options),
      loadGammaSyncCursors(),
    ])
    return await runWhileLocked(sources, options, startedAt, timeLimitMs, result, persistedCursors)
  }
  catch (error) {
    await releaseGammaSyncLock('error', {
      errorMessage: error instanceof Error ? error.message : 'unknown gamma-sync error',
    })
    throw error
  }
}

interface ResolvedGammaSource {
  sourceUrl: string
  displayName: string
}

async function resolveGammaSources(options: GammaSyncOptions): Promise<ResolvedGammaSource[]> {
  if (options.sourceUrls && options.sourceUrls.length > 0) {
    return dedupeGammaSources(options.sourceUrls.map(buildSourceFromUrl))
  }

  const explicit = normalizeSourceUrl(process.env.GAMMA_URL ?? '')
  const defaultSources = [
    ...(explicit.length > 0 ? [buildSourceFromUrl(explicit)] : []),
    buildSourceFromUrl(POLYMARKET_GAMMA_URL),
  ]

  const { data, error } = await AllowedMarketCreatorRepository.listGammaApiSources()
  if (error) {
    throw new Error(`Failed to load gamma_api sources: ${error}`)
  }
  const registered = (data ?? []).map(record => ({
    sourceUrl: normalizeSourceUrl(record.sourceUrl),
    displayName: record.displayName,
  }))
  return dedupeGammaSources([...defaultSources, ...registered])
}

function buildSourceFromUrl(url: string): ResolvedGammaSource {
  const sourceUrl = normalizeSourceUrl(url)
  return { sourceUrl, displayName: deriveSourceDisplayName(sourceUrl) }
}

function dedupeGammaSources(sources: ResolvedGammaSource[]): ResolvedGammaSource[] {
  const seen = new Set<string>()
  const result: ResolvedGammaSource[] = []
  for (const source of sources) {
    if (!source.sourceUrl || seen.has(source.sourceUrl)) {
      continue
    }
    seen.add(source.sourceUrl)
    result.push(source)
  }
  return result
}

function normalizeSourceUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function deriveSourceDisplayName(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).host
  }
  catch {
    return sourceUrl
  }
}

async function runWhileLocked(
  sources: ResolvedGammaSource[],
  options: GammaSyncOptions,
  startedAt: number,
  timeLimitMs: number,
  result: GammaSyncResult,
  persistedCursors: GammaCursorMap,
): Promise<GammaSyncResult> {
  const changedEventSlugs = new Set<string>()
  let listAffectingChange = false
  let urlSetChanged = false
  const nextCursors: GammaCursorMap = {}
  const lanes = DEFAULT_GAMMA_SYNC_LANES

  for (const source of sources) {
    for (const lane of lanes) {
      const cursorKey = getGammaSyncCursorKey(source.sourceUrl, lane)

      if (Date.now() - startedAt > timeLimitMs) {
        result.timeLimitReached = true
        if (lane.persistCursor) {
          nextCursors[cursorKey] = persistedCursors[cursorKey] ?? null
        }
        continue
      }

      const startCursor = lane.persistCursor
        ? options.startCursor !== undefined
          ? options.startCursor
          : persistedCursors[cursorKey] ?? null
        : null

      const sourceResult = await syncSingleSource(
        source,
        lane,
        options,
        startedAt,
        timeLimitMs,
        startCursor,
        {
          changedEventSlugs,
          onListAffecting: () => { listAffectingChange = true },
          onUrlSetChanged: () => { urlSetChanged = true },
          collectError: error => result.errors.push(error),
        },
      )

      result.sources.push(sourceResult)
      result.totalEventsInserted += sourceResult.eventsInserted
      result.totalEventsUpdated += sourceResult.eventsUpdated
      result.totalMarketsInserted += sourceResult.marketsInserted
      result.totalMarketsUpdated += sourceResult.marketsUpdated
      result.totalMarketsSkipped += sourceResult.marketsSkipped
      if (sourceResult.timeLimitReached) {
        result.timeLimitReached = true
      }
      if (lane.persistCursor) {
        // A null cursor means we exhausted the historical lane; next run wraps
        // back to the start of the volume-sorted feed to refresh top events.
        nextCursors[cursorKey] = sourceResult.cursor
      }
    }
  }

  for (const slug of changedEventSlugs) {
    if (safeRevalidateTag(cacheTags.event(slug))) {
      result.cacheTagsRevalidated += 1
    }
  }
  if (listAffectingChange && safeRevalidateTag(cacheTags.eventsList)) {
    result.cacheTagsRevalidated += 1
  }
  if (urlSetChanged && safeRevalidateTag(cacheTags.sitemap)) {
    result.cacheTagsRevalidated += 1
  }

  await releaseGammaSyncLock('completed', {
    totalProcessed: result.totalMarketsInserted + result.totalMarketsUpdated,
    cursors: nextCursors,
  })
  return result
}

function getGammaSyncCursorKey(sourceUrl: string, lane: GammaSyncLane) {
  // Preserve the pre-lane cursor key for the historical all-volume crawl so
  // existing production cursor state survives this deployment.
  if (lane.id === 'all-volume') {
    return sourceUrl
  }

  return `${sourceUrl}#${lane.id}`
}

function safeRevalidateTag(tag: string): boolean {
  try {
    revalidateTag(tag, 'max')
    return true
  }
  catch {
    return false
  }
}

interface SourceContext {
  changedEventSlugs: Set<string>
  onListAffecting: () => void
  onUrlSetChanged: () => void
  collectError: (error: GammaSyncError) => void
}

async function syncSingleSource(
  source: ResolvedGammaSource,
  lane: GammaSyncLane,
  options: GammaSyncOptions,
  startedAt: number,
  timeLimitMs: number,
  startCursor: string | null,
  context: SourceContext,
): Promise<GammaSourceResult> {
  const client = new GammaClient({
    baseUrl: source.sourceUrl,
    pageSize: options.pageSize ?? lane.pageSize,
    order: lane.order,
    state: lane.state,
  })
  const sourceResult: GammaSourceResult = {
    sourceUrl: source.sourceUrl,
    displayName: `${source.displayName} (${lane.displayName})`,
    lane: lane.id,
    pagesFetched: 0,
    eventsSeen: 0,
    eventsSkippedNoMarkets: 0,
    eventsInserted: 0,
    eventsUpdated: 0,
    marketsInserted: 0,
    marketsUpdated: 0,
    marketsSkipped: 0,
    cursor: startCursor,
    timeLimitReached: false,
  }

  let cursor: string | null = startCursor
  let firstPage = true
  const maxPages = options.maxPagesPerSource ?? lane.maxPagesPerSource ?? Number.POSITIVE_INFINITY

  while (firstPage || cursor) {
    if (Date.now() - startedAt > timeLimitMs) {
      sourceResult.timeLimitReached = true
      break
    }
    if (sourceResult.pagesFetched >= maxPages) {
      break
    }

    firstPage = false
    const page = await client.fetchEventsPage(cursor)
    sourceResult.pagesFetched += 1

    let pageFullyProcessed = true
    for (const gammaEvent of page.events) {
      // Per-event time check. Without this, a single page of 100 events whose
      // events each have 40+ markets (NBA, NHL, LoL...) can run hundreds of
      // sequential market upserts and overshoot timeLimitMs by minutes,
      // exceeding the lambda's hard maxDuration limit and leaking the lock.
      if (Date.now() - startedAt > timeLimitMs) {
        sourceResult.timeLimitReached = true
        pageFullyProcessed = false
        break
      }
      sourceResult.eventsSeen += 1
      try {
        const eventOutcome = await processEvent(gammaEvent)
        if (eventOutcome.skippedNoValidMarkets) {
          sourceResult.eventsSkippedNoMarkets += 1
        }
        if (eventOutcome.eventInserted) {
          sourceResult.eventsInserted += 1
        }
        else if (eventOutcome.eventUpdated) {
          sourceResult.eventsUpdated += 1
        }
        sourceResult.marketsInserted += eventOutcome.marketsInserted
        sourceResult.marketsUpdated += eventOutcome.marketsUpdated
        sourceResult.marketsSkipped += eventOutcome.marketsSkipped
        for (const error of eventOutcome.errors) {
          context.collectError({ ...error, source: source.sourceUrl })
        }

        if (eventOutcome.changedSlug) {
          context.changedEventSlugs.add(eventOutcome.changedSlug)
        }
        if (eventOutcome.listAffecting) {
          context.onListAffecting()
        }
        if (eventOutcome.urlSetChanged) {
          context.onUrlSetChanged()
        }
      }
      catch (error) {
        context.collectError({
          scope: 'event',
          id: gammaEvent.slug ?? (gammaEvent.id != null ? String(gammaEvent.id) : 'unknown'),
          source: source.sourceUrl,
          message: error instanceof Error ? error.message : 'unknown event error',
        })
      }
    }

    // Only advance the cursor if we fully consumed this page. If we broke out
    // mid-page on the time check, the next tick must re-fetch this page and
    // resume — advancing cursor would silently skip the unprocessed tail.
    if (pageFullyProcessed) {
      cursor = page.nextCursor
      sourceResult.cursor = lane.persistCursor ? page.nextCursor : null
    }
    else {
      sourceResult.cursor = lane.persistCursor ? cursor : null
      break
    }
  }

  return sourceResult
}

interface EventProcessOutcome {
  eventInserted: boolean
  eventUpdated: boolean
  skippedNoValidMarkets: boolean
  marketsInserted: number
  marketsUpdated: number
  marketsSkipped: number
  changedSlug: string | null
  listAffecting: boolean
  urlSetChanged: boolean
  errors: GammaSyncError[]
}

function emptyEventOutcome(): EventProcessOutcome {
  return {
    eventInserted: false,
    eventUpdated: false,
    skippedNoValidMarkets: false,
    marketsInserted: 0,
    marketsUpdated: 0,
    marketsSkipped: 0,
    changedSlug: null,
    listAffecting: false,
    urlSetChanged: false,
    errors: [],
  }
}

async function processEvent(gammaEvent: GammaEvent): Promise<EventProcessOutcome> {
  const outcome = emptyEventOutcome()

  const mappedEvent = mapEvent(gammaEvent)
  if (!mappedEvent) {
    outcome.marketsSkipped += gammaEvent.markets?.length ?? 0
    return outcome
  }
  if (!Array.isArray(gammaEvent.markets) || gammaEvent.markets.length === 0) {
    return outcome
  }

  const validMarkets = collectValidMarkets(gammaEvent.markets, outcome)
  if (validMarkets.length === 0) {
    outcome.skippedNoValidMarkets = true
    return outcome
  }

  const eventResult = await upsertEvent(mappedEvent)
  if (eventResult.inserted) {
    outcome.eventInserted = true
    outcome.changedSlug = mappedEvent.slug
    outcome.listAffecting = true
    outcome.urlSetChanged = true
  }
  else if (eventResult.changed) {
    outcome.eventUpdated = true
    outcome.changedSlug = mappedEvent.slug
    outcome.listAffecting = eventResult.listAffectingChange
  }

  await linkEventTags(eventResult.eventId, mapTags(gammaEvent.tags))

  try {
    const batch = await upsertMarketsForEvent(validMarkets, eventResult.eventId)
    outcome.marketsInserted += batch.inserted
    outcome.marketsUpdated += batch.updated
    if (batch.inserted > 0 || batch.updated > 0) {
      outcome.changedSlug = mappedEvent.slug
    }
    if (batch.urlSetChanged) {
      outcome.urlSetChanged = true
    }
  }
  catch (error) {
    outcome.marketsSkipped += validMarkets.length
    outcome.errors.push({
      scope: 'market',
      id: mappedEvent.slug,
      message: error instanceof Error ? error.message : 'unknown market batch write error',
    })
  }

  return outcome
}

function collectValidMarkets(gammaMarkets: GammaMarket[], outcome: EventProcessOutcome): MappedMarket[] {
  const valid: MappedMarket[] = []
  for (const gammaMarket of gammaMarkets) {
    try {
      valid.push(mapMarket(gammaMarket))
    }
    catch (error) {
      outcome.marketsSkipped += 1
      const id = error instanceof GammaMappingError
        ? error.subject
        : (gammaMarket.conditionId ?? gammaMarket.id ?? 'unknown')
      outcome.errors.push({
        scope: 'market',
        id,
        message: error instanceof Error ? error.message : 'unknown market mapping error',
      })
    }
  }
  return valid
}
