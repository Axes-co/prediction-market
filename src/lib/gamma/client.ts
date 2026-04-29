import type { GammaKeysetPage } from './types'

export type GammaEventOrder = 'volume' | 'createdAt' | 'endDate'

export interface GammaClientOptions {
  baseUrl?: string
  pageSize?: number
  requestTimeoutMs?: number
  fetcher?: typeof fetch
  order?: GammaEventOrder
}

const DEFAULT_BASE_URL = 'https://gamma-api.polymarket.com'
const DEFAULT_PAGE_SIZE = 100
const DEFAULT_TIMEOUT_MS = 20_000
const MAX_PAGE_SIZE = 500
const DEFAULT_ORDER: GammaEventOrder = 'volume'

export class GammaClient {
  private readonly baseUrl: string
  private readonly pageSize: number
  private readonly requestTimeoutMs: number
  private readonly fetcher: typeof fetch
  private readonly order: GammaEventOrder

  constructor(options: GammaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.GAMMA_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    const requested = options.pageSize ?? DEFAULT_PAGE_SIZE
    this.pageSize = Math.min(Math.max(requested, 1), MAX_PAGE_SIZE)
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetcher = options.fetcher ?? fetch
    this.order = options.order ?? DEFAULT_ORDER
  }

  async fetchActiveEventsPage(cursor: string | null): Promise<GammaKeysetPage> {
    const params = new URLSearchParams({
      limit: String(this.pageSize),
      closed: 'false',
      active: 'true',
      archived: 'false',
      include_tags: 'true',
      order: this.order,
      ascending: 'false',
    })
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
