import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBalance } from '@/hooks/useBalance'
import { useUser } from '@/stores/useUser'

vi.mock('@/lib/contracts', () => ({
  COLLATERAL_TOKEN_ADDRESS: '0x0000000000000000000000000000000000000001',
  PUSD_ADDRESS: '0x0000000000000000000000000000000000000002',
  NATIVE_USDC_TOKEN_ADDRESS: '0x0000000000000000000000000000000000000003',
}))

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useBalance', () => {
  beforeEach(() => {
    useUser.setState(null)
    fetchMock.mockReset()
  })

  afterEach(() => {
    useUser.setState(null)
  })

  it('loads the proxy pUSD balance from the wallet balances API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [
          { address: '0x0000000000000000000000000000000000000002', rawBase: '123450000' },
        ],
      }),
    })

    useUser.setState({
      id: 'user-1',
      address: '0x00000000000000000000000000000000000000bb',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'trader',
      image: '',
      settings: {},
      is_admin: false,
      proxy_wallet_address: '0x00000000000000000000000000000000000000aa',
      proxy_wallet_status: 'deployed',
    })

    const { result } = renderHook(() => useBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/wallet/polygon-usdc-balances', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ walletAddress: '0x00000000000000000000000000000000000000aa' }),
    }))
    expect(result.current.balance.raw).toBe(123.45)
    expect(result.current.balance.text).toBe('123.45')
  })

  it('stops loading when there is no proxy wallet to query yet', async () => {
    useUser.setState({
      id: 'user-2',
      address: '0x00000000000000000000000000000000000000cc',
      email: 'user@example.com',
      twoFactorEnabled: null,
      username: 'new-user',
      image: '',
      settings: {},
      is_admin: false,
      proxy_wallet_address: null,
      proxy_wallet_status: 'not_started',
    })

    const { result } = renderHook(() => useBalance(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoadingBalance).toBe(false)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.balance.raw).toBe(0)
    expect(result.current.balance.text).toBe('0.00')
  })
})
