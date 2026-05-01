import { describe, expect, it, vi } from 'vitest'
import { GammaClient } from '@/lib/gamma/client'

function mockResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('gammaClient.fetchActiveEventsPage', () => {
  it('omits cursor params on the first page', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({ events: [], next_cursor: 'abc' }),
    )
    const client = new GammaClient({ fetcher, baseUrl: 'https://gamma-api.test' })

    await client.fetchActiveEventsPage(null)

    const url = String(fetcher.mock.calls[0]?.[0])
    expect(url).not.toContain('after_cursor')
    expect(url).not.toContain('next_cursor')
    expect(url).toContain('limit=500')
  })

  it('passes active lifecycle and current-volume order params when configured', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({ events: [], next_cursor: null }),
    )
    const client = new GammaClient({
      fetcher,
      baseUrl: 'https://gamma-api.test',
      order: 'volume24hr',
      state: 'active',
    })

    await client.fetchEventsPage(null)

    const url = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(url.searchParams.get('order')).toBe('volume24hr')
    expect(url.searchParams.get('active')).toBe('true')
    expect(url.searchParams.get('closed')).toBe('false')
    expect(url.searchParams.get('archived')).toBe('false')
  })

  it('passes cursor as after_cursor on subsequent pages', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({ events: [], next_cursor: null }),
    )
    const client = new GammaClient({ fetcher, baseUrl: 'https://gamma-api.test' })

    await client.fetchActiveEventsPage('OPAQUE_TOKEN')

    const url = String(fetcher.mock.calls[0]?.[0])
    expect(url).toContain('after_cursor=OPAQUE_TOKEN')
    expect(url).not.toContain('next_cursor=')
  })

  it('reads next_cursor from the response body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({ events: [], next_cursor: 'NEXT_TOKEN' }),
    )
    const client = new GammaClient({ fetcher, baseUrl: 'https://gamma-api.test' })

    const page = await client.fetchActiveEventsPage(null)

    expect(page.nextCursor).toBe('NEXT_TOKEN')
  })

  it('returns nextCursor=null when response next_cursor is empty', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({ events: [], next_cursor: '' }),
    )
    const client = new GammaClient({ fetcher, baseUrl: 'https://gamma-api.test' })

    const page = await client.fetchActiveEventsPage(null)

    expect(page.nextCursor).toBeNull()
  })
})
