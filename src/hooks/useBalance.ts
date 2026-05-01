import type { Address } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { PUSD_ADDRESS } from '@/lib/contracts'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

/**
 * Trading-side balance reader. Polymarket V2 settles every CLOB trade and
 * every CTF split / merge / redeem in **pUSD** — the wrapped collateral
 * token at `PUSD_ADDRESS`. Reading USDC.e at the Safe proxy here was a V1
 * holdover that produced "$0 to spend" right after a successful Onramp
 * wrap (USDC.e is consumed during wrap; pUSD is what gets minted to the
 * proxy).
 *
 * Pre-wrap funds (native USDC, USDC.e) live behind `usePendingUsdcDeposit`
 * and `useProxyDepositBalance` — the deposit dialog handles wrapping them
 * into pUSD before they show up here.
 */

interface Balance {
  raw: number
  text: string
  symbol: string
}

// Query-key kept stable across the V1→V2 collateral switch so existing
// `queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })`
// callers (post-trade refresh, withdrawal etc.) keep working.
export const SAFE_BALANCE_QUERY_KEY = 'safe-usdc-balance'

const PUSD_DECIMALS = 6
// Display label stays "USDC" because that's the user-facing concept (pUSD is
// 1:1 backed by USDC and the user thinks in USDC). Internal trading code
// reads `raw`/`rawBase` for amounts.
const INITIAL_STATE: Balance = {
  raw: 0.0,
  text: '0.00',
  symbol: 'USDC',
}

interface UseBalanceOptions {
  enabled?: boolean
}

interface PolymarketWalletBalanceResponseItem {
  address: string
  rawBase: string
}

export function useBalance(options: UseBalanceOptions = {}) {
  const user = useUser()

  const proxyWalletAddress: Address | null = user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address) as Address | null
    : null

  const isOptionsEnabled = options.enabled ?? true
  const isQueryEnabled = Boolean(proxyWalletAddress && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [SAFE_BALANCE_QUERY_KEY, proxyWalletAddress],
    enabled: isQueryEnabled,
    staleTime: 'static',
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Balance> => {
      if (!proxyWalletAddress) {
        return INITIAL_STATE
      }

      try {
        const response = await fetch('/api/wallet/polygon-usdc-balances', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ walletAddress: proxyWalletAddress }),
        })
        if (!response.ok) {
          return INITIAL_STATE
        }

        const payload = await response.json() as { balances?: PolymarketWalletBalanceResponseItem[] }
        const pusdBalance = (payload.balances ?? [])
          .find(balance => balance.address.toLowerCase() === PUSD_ADDRESS.toLowerCase())
        const balanceRaw = BigInt(pusdBalance?.rawBase ?? '0')
        const balanceNumber = Number(balanceRaw) / 10 ** PUSD_DECIMALS

        return {
          raw: balanceNumber,
          text: balanceNumber.toFixed(2),
          symbol: 'USDC',
        }
      }
      catch {
        return INITIAL_STATE
      }
    },
  })

  const balance = isQueryEnabled && data ? data : INITIAL_STATE
  const isLoadingBalance = isQueryEnabled ? (isLoading || (!data && isFetching)) : false

  return {
    balance,
    isLoadingBalance,
    refetchBalance: refetch,
  }
}
