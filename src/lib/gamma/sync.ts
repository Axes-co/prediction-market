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

const DEFAULT_TIME_LIMIT_MS = 250_000

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
    return options.sourceUrls.map(buildSourceFromUrl)
  }

  const { data, error } = await AllowedMarketCreatorRepository.listGammaApiSources()
  if (error) {
    throw new Error(`Failed to load gamma_api sources: ${error}`)
  }
  const registered = (data ?? []).map(record => ({
    sourceUrl: normalizeSourceUrl(record.sourceUrl),
    displayName: record.displayName,
  }))
  if (registered.length > 0) {
    return registered
  }

  const fallback = normalizeSourceUrl(process.env.GAMMA_URL ?? '')
  return fallback.length > 0 ? [buildSourceFromUrl(fallback)] : []
}

function buildSourceFromUrl(url: string): ResolvedGammaSource {
  const sourceUrl = normalizeSourceUrl(url)
  return { sourceUrl, displayName: deriveSourceDisplayName(sourceUrl) }
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

  for (const source of sources) {
    if (Date.now() - startedAt > timeLimitMs) {
      result.timeLimitReached = true
      // Carry the unconsumed cursor forward so the next cron tick resumes here.
      nextCursors[source.sourceUrl] = persistedCursors[source.sourceUrl] ?? null
      continue
    }

    const startCursor = options.startCursor !== undefined
      ? options.startCursor
      : persistedCursors[source.sourceUrl] ?? null

    const sourceResult = await syncSingleSource(
      source,
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
    // A null cursor means we exhausted the source; next run wraps back to the
    // start of the volume-sorted feed to refresh top events.
    nextCursors[source.sourceUrl] = sourceResult.cursor
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
  options: GammaSyncOptions,
  startedAt: number,
  timeLimitMs: number,
  startCursor: string | null,
  context: SourceContext,
): Promise<GammaSourceResult> {
  const client = new GammaClient({ baseUrl: source.sourceUrl, pageSize: options.pageSize })
  const sourceResult: GammaSourceResult = {
    sourceUrl: source.sourceUrl,
    displayName: source.displayName,
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
  const maxPages = options.maxPagesPerSource ?? Number.POSITIVE_INFINITY

  while (firstPage || cursor) {
    if (Date.now() - startedAt > timeLimitMs) {
      sourceResult.timeLimitReached = true
      break
    }
    if (sourceResult.pagesFetched >= maxPages) {
      break
    }

    firstPage = false
    const page = await client.fetchActiveEventsPage(cursor)
    sourceResult.pagesFetched += 1
    sourceResult.cursor = page.nextCursor

    for (const gammaEvent of page.events) {
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

    cursor = page.nextCursor
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
