import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRelayerTransaction, parseRelayerSubmitResponse } from '@/lib/polymarket/relayer-poll'

describe('relayer poll helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('polls transaction status without builder auth headers', async () => {
    vi.stubEnv('RELAYER_URL', 'https://relayer-v2.polymarket.com')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        transactionID: 'tx-1',
        transactionHash: '0xabc',
        state: 'STATE_CONFIRMED',
      }],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRelayerTransaction('tx-1')

    expect(result?.state).toBe('STATE_CONFIRMED')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relayer-v2.polymarket.com/transaction?id=tx-1',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('parses v2 transaction ids and legacy hashes', () => {
    expect(parseRelayerSubmitResponse({ transactionID: 'abc', state: 'STATE_NEW' })).toEqual({
      transactionID: 'abc',
      state: 'STATE_NEW',
      legacyTxHash: null,
    })
    expect(parseRelayerSubmitResponse({ txHash: '0xhash' })).toEqual({
      transactionID: null,
      state: null,
      legacyTxHash: '0xhash',
    })
  })
})
