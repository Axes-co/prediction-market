import type { Address, PublicClient } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, formatUnits, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
import { COLLATERAL_TOKEN_ADDRESS, NATIVE_USDC_TOKEN_ADDRESS, PUSD_ADDRESS } from '@/lib/contracts'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const USDC_DECIMALS = 6
const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

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

const RPC_URL = defaultNetwork.rpcUrls.default.http[0]

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

  const client = useMemo<PublicClient>(() => createPublicClient({
    chain: defaultNetwork,
    transport: http(RPC_URL),
  }), [])

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
        const [nativeUsdcRaw, usdceRaw, pusdRaw] = await Promise.all([
          client.readContract({
            address: NATIVE_USDC_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [proxyWalletAddress],
          }) as Promise<bigint>,
          client.readContract({
            address: COLLATERAL_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [proxyWalletAddress],
          }) as Promise<bigint>,
          client.readContract({
            address: PUSD_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [proxyWalletAddress],
          }) as Promise<bigint>,
        ])

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
