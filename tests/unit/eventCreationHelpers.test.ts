import type { EventCreationDraftRecord } from '@/lib/db/queries/event-creations'
import { describe, expect, it } from 'vitest'
import { expandEventCreationOccurrences } from '@/lib/event-creation'
import { parseEventCreationSignerPrivateKeys } from '@/lib/event-creation-signers'
import { buildEventCreationPreparePayload, computeNextRecurringSchedule } from '@/lib/event-creation-worker'

function buildDraft(overrides: Partial<EventCreationDraftRecord> = {}): EventCreationDraftRecord {
  return {
    id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
    title: 'BTC will rise?',
    slug: 'btc-will-rise',
    titleTemplate: 'BTC will rise on {{day}} {{month_name}}?',
    slugTemplate: 'btc-will-rise-{{day_padded}}-{{month_name_lower}}',
    creationMode: 'recurring',
    status: 'scheduled',
    startAt: '2026-03-22T12:00:00.000Z',
    deployAt: '2026-03-21T12:00:00.000Z',
    recurrenceUnit: 'month',
    recurrenceInterval: 1,
    recurrenceUntil: '2026-06-30T23:59:00.000Z',
    walletAddress: '0x1111111111111111111111111111111111111111',
    updatedAt: '2026-03-22T10:00:00.000Z',
    endDate: '2026-03-22T12:00:00.000Z',
    mainCategorySlug: 'crypto',
    categorySlugs: ['bitcoin', 'price-action', 'macro', 'march'],
    marketMode: 'binary',
    binaryQuestion: 'BTC will rise?',
    binaryOutcomeYes: 'Yes',
    binaryOutcomeNo: 'No',
    resolutionSource: 'https://example.com',
    resolutionRules: 'Resolve YES if BTC closes above the opening price.',
    draftPayload: {
      form: {
        title: 'BTC will rise?',
        slug: 'btc-will-rise',
        endDateIso: '2026-03-22T12:00',
        mainCategorySlug: 'crypto',
        categories: [
          { label: 'Bitcoin', slug: 'bitcoin' },
          { label: 'Price Action', slug: 'price-action' },
          { label: 'Macro', slug: 'macro' },
          { label: 'March', slug: 'march' },
        ],
        marketMode: 'binary',
        binaryOutcomeYes: 'Yes',
        binaryOutcomeNo: 'No',
        resolutionSource: 'https://example.com',
        resolutionRules: 'Resolve YES if BTC closes above the opening price.',
      },
    },
    assetPayload: {
      eventImage: null,
      optionImages: {},
      teamLogos: {},
    },
    pendingRequestId: null,
    pendingPayloadHash: null,
    pendingChainId: null,
    pendingConfirmedTxs: [],
    ...overrides,
  }
}

describe('event creation helpers', () => {
  it('expands recurring calendar occurrences with title templates', () => {
    const occurrences = expandEventCreationOccurrences({
      id: 'draft-1',
      title: 'BTC will rise?',
      slug: 'btc-will-rise',
      titleTemplate: 'BTC will rise on {{day}} {{month_name}}?',
      slugTemplate: 'btc-will-rise-{{day_padded}}-{{month_name_lower}}',
      startAt: '2026-03-22T12:00:00.000Z',
      status: 'scheduled',
      creationMode: 'recurring',
      recurrenceUnit: 'month',
      recurrenceInterval: 1,
      recurrenceUntil: '2026-05-31T23:59:00.000Z',
      maxOccurrences: 4,
    })

    expect(occurrences).toHaveLength(3)
    expect(occurrences[0]?.title).toBe('BTC will rise on 22 March?')
    expect(occurrences[1]?.title).toBe('BTC will rise on 22 April?')
    expect(occurrences[2]?.title).toBe('BTC will rise on 22 May?')
  })

  it('parses signer private keys from env arrays and dedupes by address', () => {
    const signers = parseEventCreationSignerPrivateKeys(JSON.stringify([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]))

    expect(signers).toHaveLength(1)
    expect(signers[0]?.address).toMatch(/^0x[a-f0-9]{40}$/)
  })

  it('builds recurring prepare payloads using the scheduled occurrence date', () => {
    const result = buildEventCreationPreparePayload({
      record: buildDraft(),
      creator: '0x1111111111111111111111111111111111111111',
      chainId: 80002,
    })

    expect(result.payload.title).toBe('BTC will rise on 22 March?')
    expect(result.payload.slug).toBe('btc-will-rise-22-march')
    expect(result.payload.endDateIso).toBe('2026-03-22T12:00:00.000Z')
    expect(result.payload.binaryOutcomeYes).toBe('Yes')
  })

  it('computes the next recurring schedule and deploy window', () => {
    const next = computeNextRecurringSchedule(buildDraft())

    expect(next?.nextStartAt.toISOString()).toBe('2026-04-22T12:00:00.000Z')
    expect(next?.nextDeployAt?.toISOString()).toBe('2026-04-21T12:00:00.000Z')
  })
})
