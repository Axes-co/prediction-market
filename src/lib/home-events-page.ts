import type { SupportedLocale } from '@/i18n/locales'
import type { EventListSortBy, EventListStatusFilter } from '@/lib/event-list-filters'
import type { Event } from '@/types'
import { EventRepository } from '@/lib/db/queries/event'
import { filterHomeEvents, HOME_EVENTS_PAGE_SIZE } from '@/lib/home-events'

const HOME_EVENTS_QUERY_BATCH_SIZE = 128
// Dev cap to avoid vercel/next.js#87772: visitAsyncNode infinite recursion when
// large RSC async result trees blow Turbopack's dev runtime stack.
const HOME_EVENTS_DEV_QUERY_CAP = 32

interface ListHomeEventsPageOptions {
  bookmarked: boolean
  currentTimestamp?: number | null
  frequency?: 'all' | 'daily' | 'weekly' | 'monthly'
  hideCrypto?: boolean
  hideEarnings?: boolean
  hideSports?: boolean
  locale: SupportedLocale
  mainTag: string
  offset?: number
  search?: string
  sortBy?: EventListSortBy
  sportsSection?: 'games' | 'props' | ''
  sportsSportSlug?: string
  status?: EventListStatusFilter
  tag: string
  userId: string
}

interface LoadHomeEventCandidatesOptions extends Omit<ListHomeEventsPageOptions, 'currentTimestamp'> {}

async function loadHomeEventCandidates({
  bookmarked,
  frequency = 'all',
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  locale,
  mainTag,
  offset = 0,
  search = '',
  sortBy,
  sportsSection = '',
  sportsSportSlug = '',
  status = 'active',
  tag,
  userId,
}: LoadHomeEventCandidatesOptions) {
  // No `'use cache'` here. With the events table at ~1.7k rows the loop below
  // runs up to 3 sequential `EventRepository.listEvents` calls (each its own
  // `'use cache'` boundary already tagged with `cacheTags.eventsList` and
  // `cacheTags.events(userId)`). Wrapping the loop in an outer cache scope
  // forced the sum of the inner fills into a single 50s prerender budget,
  // which produced USE_CACHE_TIMEOUT once the events table grew past the
  // single-batch threshold (`d33149d5` documented the failure mode but the
  // outer/inner page split alone wasn't enough — the inner data layer is the
  // right place to cache, per next.js use-cache + i18n guidance).
  const targetOffset = Math.max(0, offset)
  const targetVisibleCount = targetOffset + HOME_EVENTS_PAGE_SIZE
  const isDev = process.env.NODE_ENV === 'development'
  const batchSize = isDev ? HOME_EVENTS_DEV_QUERY_CAP : HOME_EVENTS_QUERY_BATCH_SIZE
  let rawOffset = 0
  const accumulatedEvents: Event[] = []

  while (true) {
    const { data: rawEvents, error } = await EventRepository.listEvents({
      tag,
      mainTag,
      search,
      sortBy,
      userId,
      bookmarked,
      frequency,
      status,
      offset: rawOffset,
      limit: batchSize,
      locale,
      sportsSportSlug,
      sportsSection,
    })

    if (error) {
      return { data: [], error }
    }

    const batch = rawEvents ?? []
    if (batch.length === 0) {
      break
    }

    accumulatedEvents.push(...batch)

    if (status === 'resolved') {
      const visibleResolvedEvents = filterHomeEvents(accumulatedEvents, {
        currentTimestamp: null,
        hideSports,
        hideCrypto,
        hideEarnings,
        status,
      })

      if (visibleResolvedEvents.length >= targetVisibleCount) {
        break
      }
    }

    if (batch.length < batchSize) {
      break
    }

    if (isDev) {
      break
    }

    rawOffset += batchSize
  }

  return {
    data: accumulatedEvents,
    error: null,
  }
}

export async function listHomeEventsPage({
  currentTimestamp,
  hideCrypto = false,
  hideEarnings = false,
  hideSports = false,
  offset = 0,
  status = 'active',
  ...options
}: ListHomeEventsPageOptions) {
  const targetOffset = Math.max(0, offset)
  const resolvedCurrentTimestamp = currentTimestamp ?? null

  const { data: rawEvents, error } = await loadHomeEventCandidates({
    ...options,
    hideCrypto,
    hideEarnings,
    hideSports,
    offset,
    status,
  })

  if (error) {
    return { data: [], error, currentTimestamp: resolvedCurrentTimestamp ?? null }
  }

  const visibleEvents = (rawEvents?.length ?? 0) > 0
    ? filterHomeEvents(rawEvents ?? [], {
        currentTimestamp: resolvedCurrentTimestamp,
        hideSports,
        hideCrypto,
        hideEarnings,
        status,
      })
    : []

  return {
    data: visibleEvents.slice(targetOffset, targetOffset + HOME_EVENTS_PAGE_SIZE),
    error: null,
    currentTimestamp: resolvedCurrentTimestamp ?? null,
  }
}
