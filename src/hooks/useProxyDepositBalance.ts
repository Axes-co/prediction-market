import type { Address } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { COLLATERAL_TOKEN_ADDRESS, NATIVE_USDC_TOKEN_ADDRESS, PUSD_ADDRESS } from '@/lib/contracts'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const USDC_DECIMALS = 6
const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const PROXY_DEPOSIT_BALANCE_QUERY_KEY = 'proxy-deposit-balance'

interface ProxyDepositBalance {
  /** Native Circle USDC held at the Safe proxy (waiting to be wrapped). */
  nativeUsdc: number
  /** USDC.e held at the Safe proxy (waiting to be wrapped). 6-decimal float. */
  usdce: number
  /** pUSD held at the Safe proxy (already wrapped, tradable). 6-decimal float. */
  pusd: number
  /** Sum of `nativeUsdc + usdce + pusd`. The user's total platform balance, USD-equivalent. */
  total: number
  /** Pre-formatted total for display (e.g., "12.34"). */
  totalFormatted: string
}

const INITIAL_STATE: ProxyDepositBalance = {
  nativeUsdc: 0,
  usdce: 0,
  pusd: 0,
  total: 0,
  totalFormatted: '0.00',
}

interface UseProxyDepositBalanceOptions {
  enabled?: boolean
}

interface PolymarketWalletBalanceResponseItem {
  address: string
  rawBase: string
}

/**
 * Reads the Safe proxy's native USDC, USDC.e, and pUSD balances and exposes
 * the combined total. Used in the deposit modal's "Axes Balance" header so
 * the displayed number is the user's actual at-the-platform funds, regardless
 * of whether they have wrapped via the Onramp yet.
 *
 * Trading-side hooks (`useBalance`) continue to read pUSD only because that is
 * the actual CLOB/CTF collateral after activation.
 */
export function useProxyDepositBalance(options: UseProxyDepositBalanceOptions = {}) {
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
    queryKey: [PROXY_DEPOSIT_BALANCE_QUERY_KEY, proxyWalletAddress],
    enabled: isQueryEnabled,
    staleTime: 'static',
    gcTime: 5 * 60 * 1000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<ProxyDepositBalance> => {
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
        const balancesByAddress = new Map(
          (payload.balances ?? []).map(balance => [balance.address.toLowerCase(), balance]),
        )
        const nativeUsdcRaw = BigInt(balancesByAddress.get(NATIVE_USDC_TOKEN_ADDRESS.toLowerCase())?.rawBase ?? '0')
        const usdceRaw = BigInt(balancesByAddress.get(COLLATERAL_TOKEN_ADDRESS.toLowerCase())?.rawBase ?? '0')
        const pusdRaw = BigInt(balancesByAddress.get(PUSD_ADDRESS.toLowerCase())?.rawBase ?? '0')

        const nativeUsdc = Number(formatUnits(nativeUsdcRaw, USDC_DECIMALS))
        const usdce = Number(formatUnits(usdceRaw, USDC_DECIMALS))
        const pusd = Number(formatUnits(pusdRaw, USDC_DECIMALS))
        const total = nativeUsdc + usdce + pusd

        return {
          nativeUsdc,
          usdce,
          pusd,
          total,
          totalFormatted: USD_FORMATTER.format(total),
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
