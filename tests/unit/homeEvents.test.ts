import { describe, expect, it } from 'vitest'
import { filterHomeEvents, isHomeEventResolvedLike } from '@/lib/home-events'

describe('home-events', () => {
  it('treats active events with unresolved markets as not resolved-like', () => {
    const event = {
      id: 'event-1',
      slug: 'highest-temperature-in-sao-paulo-on-march-24-2026',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: false,
          condition: { resolved: false },
        },
      ],
      tags: [],
    } as any

    expect(isHomeEventResolvedLike(event)).toBe(false)
  })

  it('keeps only fully resolved events in the resolved home filter', () => {
    const partiallyResolvedEvent = {
      id: 'event-1',
      slug: 'highest-temperature-in-sao-paulo-on-march-24-2026',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: false,
          condition: { resolved: false },
        },
      ],
      tags: [],
    } as any

    const fullyResolvedEvent = {
      id: 'event-2',
      slug: 'bra-san-vas-2026-02-26',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: true,
          condition: { resolved: true },
        },
      ],
      tags: [],
    } as any

    const resolvedStatusEvent = {
      id: 'event-3',
      slug: 'resolved-event',
      status: 'resolved',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
      ],
      tags: [],
    } as any

    expect(filterHomeEvents(
      [partiallyResolvedEvent, fullyResolvedEvent, resolvedStatusEvent],
      { status: 'resolved' },
    )).toEqual([fullyResolvedEvent, resolvedStatusEvent])
  })

  it('removes fully resolved-like rows from the active home filter even when event status is stale active', () => {
    const activeEvent = {
      id: 'active-event',
      slug: 'active-event',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: false,
          condition: { resolved: false },
        },
      ],
      tags: [],
    } as any

    const staleResolvedEvent = {
      id: 'stale-resolved-event',
      slug: 'stale-resolved-event',
      status: 'active',
      created_at: '2026-03-24T00:00:00.000Z',
      updated_at: '2026-03-24T00:00:00.000Z',
      markets: [
        {
          is_resolved: true,
          condition: { resolved: true },
        },
        {
          is_resolved: true,
          condition: { resolved: true },
        },
      ],
      tags: [],
    } as any

    expect(filterHomeEvents(
      [activeEvent, staleResolvedEvent],
      { status: 'active' },
    )).toEqual([activeEvent])
  })

  it('removes overdue unresolved rows from the active home filter when a current timestamp is available', () => {
    const futureEvent = {
      id: 'future-event',
      slug: 'future-event',
      status: 'active',
      end_date: '2026-05-02T00:00:00.000Z',
      created_at: '2026-04-30T00:00:00.000Z',
      updated_at: '2026-04-30T00:00:00.000Z',
      markets: [{ is_resolved: false }],
      tags: [],
    } as any

    const overdueUnresolvedEvent = {
      id: 'overdue-unresolved-event',
      slug: 'overdue-unresolved-event',
      status: 'active',
      end_date: '2026-04-24T00:00:00.000Z',
      created_at: '2026-04-20T00:00:00.000Z',
      updated_at: '2026-04-30T00:00:00.000Z',
      markets: [{ is_resolved: false }],
      tags: [],
    } as any

    expect(filterHomeEvents(
      [futureEvent, overdueUnresolvedEvent],
      {
        currentTimestamp: Date.parse('2026-05-01T00:00:00.000Z'),
        status: 'active',
      },
    )).toEqual([futureEvent])
  })

  it('keeps resolved events while still deduplicating active series entries for the all status', () => {
    const laterActiveEvent = {
      id: 'later-active-event',
      slug: 'later-active-event',
      series_slug: 'meta-series',
      status: 'active' as const,
      end_date: '2026-03-31T12:00:00.000Z',
      created_at: '2026-03-20T12:00:00.000Z',
      updated_at: '2026-03-20T12:00:00.000Z',
      markets: [{ is_resolved: false }],
    }
    const soonerActiveEvent = {
      id: 'sooner-active-event',
      slug: 'sooner-active-event',
      series_slug: 'meta-series',
      status: 'active' as const,
      end_date: '2026-03-27T12:00:00.000Z',
      created_at: '2026-03-21T12:00:00.000Z',
      updated_at: '2026-03-21T12:00:00.000Z',
      markets: [{ is_resolved: false }],
    }
    const resolvedEvent = {
      id: 'resolved-event',
      slug: 'resolved-event',
      series_slug: 'meta-series',
      status: 'resolved' as const,
      end_date: '2026-03-24T12:00:00.000Z',
      created_at: '2026-03-24T12:00:00.000Z',
      updated_at: '2026-03-24T12:00:00.000Z',
      markets: [{ is_resolved: true }],
    }

    expect(filterHomeEvents(
      [laterActiveEvent, soonerActiveEvent, resolvedEvent],
      {
        currentTimestamp: Date.parse('2026-03-25T12:00:00.000Z'),
        status: 'all',
      },
    )).toEqual([soonerActiveEvent, resolvedEvent])
  })
})
