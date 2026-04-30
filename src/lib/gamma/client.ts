import type { GammaKeysetPage } from './types'

export type GammaEventOrder = 'volume' | 'createdAt' | 'endDate'

/**
 * Lifecycle state filter passed to Gamma's `/events/keyset`. The Polymarket
 * UI uses these to scope event lists; we pull every state by default so
 * profile pages, history widgets, and search all have full coverage.
 */
export type GammaEventState = 'all' | 'active' | 'closed' | 'archived'

export interface GammaClientOptions {
  baseUrl?: string
  pageSize?: number
  requestTimeoutMs?: number
  fetcher?: typeof fetch
  order?: GammaEventOrder
  /** Default `'all'` so the sync covers every Polymarket event. */
  state?: GammaEventState
}

const DEFAULT_BASE_URL = 'https://gamma-api.polymarket.com'
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_TIMEOUT_MS = 20_000
const MAX_PAGE_SIZE = 500
const DEFAULT_ORDER: GammaEventOrder = 'volume'
const DEFAULT_STATE: GammaEventState = 'all'

function applyStateFilter(params: URLSearchParams, state: GammaEventState): void {
  switch (state) {
    case 'active':
      params.set('closed', 'false')
      params.set('active', 'true')
      params.set('archived', 'false')
      break
    case 'closed':
      params.set('closed', 'true')
      params.set('active', 'false')
      params.set('archived', 'false')
      break
    case 'archived':
      params.set('archived', 'true')
      break
    case 'all':
      // Omit closed/active/archived flags entirely so Gamma returns every
      // event regardless of lifecycle state. Verified against
      // `https://gamma-api.polymarket.com/events/keyset` (no filters).
      break
  }
}

export class GammaClient {
  private readonly baseUrl: string
  private readonly pageSize: number
  private readonly requestTimeoutMs: number
  private readonly fetcher: typeof fetch
  private readonly order: GammaEventOrder
  private readonly state: GammaEventState

  constructor(options: GammaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.GAMMA_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    const requested = options.pageSize ?? DEFAULT_PAGE_SIZE
    this.pageSize = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE)
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetcher = options.fetcher ?? fetch
    this.order = options.order ?? DEFAULT_ORDER
    this.state = options.state ?? DEFAULT_STATE
  }

  /**
   * Fetch one page of events from `/events/keyset`. Renamed from the original
   * `fetchActiveEventsPage` because the default state is now `all` (every
   * lifecycle), not `active`-only.
   */
  async fetchEventsPage(cursor: string | null): Promise<GammaKeysetPage> {
    const params = new URLSearchParams({
      limit: String(this.pageSize),
      include_tags: 'true',
      order: this.order,
      ascending: 'false',
    })
    applyStateFilter(params, this.state)
    if (cursor) {
      params.set('after_cursor', cursor)
    }

    const url = `${this.baseUrl}/events/keyset?${params.toString()}`
    const response = await this.requestWithTimeout(url)

    if (!response.ok) {
      throw new Error(`gamma keyset request failed (${response.status} ${response.statusText})`)
    }

    const payload = await response.json().catch(() => null) as { events?: unknown, next_cursor?: unknown } | null
    if (!payload || !Array.isArray(payload.events)) {
      throw new Error('gamma keyset response did not include an events array')
    }

    return {
      events: payload.events as GammaKeysetPage['events'],
      nextCursor: typeof payload.next_cursor === 'string' && payload.next_cursor.length > 0
        ? payload.next_cursor
        : null,
    }
  }

  /**
   * Back-compat alias for callers/tests still using the old name. Both methods
   * issue the same query — the state is determined by the constructor option.
   */
  async fetchActiveEventsPage(cursor: string | null): Promise<GammaKeysetPage> {
    return this.fetchEventsPage(cursor)
  }

  private async requestWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    try {
      return await this.fetcher(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        keepalive: true,
      })
    }
    finally {
      clearTimeout(timer)
    }
  }
}
