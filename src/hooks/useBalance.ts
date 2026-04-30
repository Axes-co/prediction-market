import type { Address, PublicClient } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, getContract, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
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
const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
]
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

const RPC_URL = defaultNetwork.rpcUrls.default.http[0]

export function useBalance(options: UseBalanceOptions = {}) {
  const user = useUser()

  const client = useMemo<PublicClient>(() => {
    return createPublicClient({
      chain: defaultNetwork,
      transport: http(RPC_URL),
    })
  }, [])

  const proxyWalletAddress: Address | null = user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address) as Address | null
    : null

  const contract = useMemo(() => {
    if (!proxyWalletAddress) {
      return null
    }

    return getContract({
      address: PUSD_ADDRESS,
      abi: ERC20_ABI,
      client,
    })
  }, [client, proxyWalletAddress])

  const isOptionsEnabled = options.enabled ?? true
  const isQueryEnabled = Boolean(client && proxyWalletAddress && isOptionsEnabled)

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
      if (!proxyWalletAddress || !contract) {
        return INITIAL_STATE
      }

      try {
        const balanceRaw = await contract.read.balanceOf([proxyWalletAddress])
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
