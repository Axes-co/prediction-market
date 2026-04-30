import type { Address } from 'viem'
import { useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createPublicClient, formatUnits, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
import { COLLATERAL_TOKEN_ADDRESS, NATIVE_USDC_TOKEN_ADDRESS } from '@/lib/contracts'
import { IS_TEST_MODE } from '@/lib/network'
import { normalizeAddress } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

/**
 * Tracks pending USDC deposits at the user's Safe proxy that have not yet
 * been wrapped into pUSD. The Polymarket `CollateralOnramp` contract accepts
 * BOTH native (Circle) USDC at `0x3c499c…` and bridged USDC.e at
 * `0x2791bca1…` — a wallet user can land on either depending on which
 * "USDC" their external wallet selects when sending. Read both balances and
 * surface whichever has funds, with the matching `_asset` address so the
 * wrap call hits the right token.
 *
 * Trading-side `useBalance` reads pUSD because pUSD is the actual V2
 * collateral. This hook stays scoped to "yet to be wrapped".
 */

interface PerTokenBalance {
  raw: number
  rawBase: string
  text: string
  symbol: string
  /** ERC-20 contract address — used as the `_asset` argument to `Onramp.wrap`. */
  asset: Address
}

interface PendingDepositSnapshot {
  /** Sum of native + bridged USDC, in float units (6 decimals). */
  raw: number
  /** Sum in 6-decimal base units, as a decimal string. */
  rawBase: string
  /** Sum formatted as a 2-decimal display string. */
  text: string
  symbol: 'USDC'
  native: PerTokenBalance | null
  bridged: PerTokenBalance | null
}

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

const INITIAL_STATE: PendingDepositSnapshot = {
  raw: 0,
  rawBase: '0',
  text: '0.00',
  symbol: 'USDC',
  native: null,
  bridged: null,
}

export const PENDING_USDC_QUERY_KEY = 'safe-pending-usdc-balance'

interface UsePendingUsdcDepositOptions {
  enabled?: boolean
}

const RPC_URL = defaultNetwork.rpcUrls.default.http[0]

function buildPerTokenBalance(rawBase: bigint, asset: Address): PerTokenBalance | null {
  if (rawBase <= 0n) {
    return null
  }
  const formatted = formatUnits(rawBase, USDC_DECIMALS)
  const raw = Number.parseFloat(formatted)
  return {
    raw: Number.isFinite(raw) ? raw : 0,
    rawBase: rawBase.toString(),
    text: Number.isFinite(raw) ? raw.toFixed(2) : '0.00',
    symbol: 'USDC',
    asset,
  }
}

export function usePendingUsdcDeposit(options: UsePendingUsdcDepositOptions = {}) {
  const { isConnected } = useAppKitAccount()
  const user = useUser()

  const client = useMemo(
    () => createPublicClient({
      chain: defaultNetwork,
      transport: http(RPC_URL),
    }),
    [],
  )

  const proxyWalletAddress: Address | null = user?.proxy_wallet_address
    ? normalizeAddress(user.proxy_wallet_address) as Address | null
    : null

  const isOptionsEnabled = (options.enabled ?? true) && !IS_TEST_MODE
  const isAwaitingConnection = Boolean(user && isOptionsEnabled && !isConnected)
  const isQueryEnabled = Boolean(isConnected && proxyWalletAddress && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [PENDING_USDC_QUERY_KEY, proxyWalletAddress],
    enabled: isQueryEnabled,
    staleTime: 'static',
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<PendingDepositSnapshot> => {
      if (!proxyWalletAddress) {
        return INITIAL_STATE
      }

      try {
        const [bridgedRaw, nativeRaw] = await Promise.all([
          client.readContract({
            address: COLLATERAL_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [proxyWalletAddress],
          }) as Promise<bigint>,
          client.readContract({
            address: NATIVE_USDC_TOKEN_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: 'balanceOf',
            args: [proxyWalletAddress],
          }) as Promise<bigint>,
        ])

        const bridged = buildPerTokenBalance(bridgedRaw, COLLATERAL_TOKEN_ADDRESS)
        const native = buildPerTokenBalance(nativeRaw, NATIVE_USDC_TOKEN_ADDRESS)
        const totalBase = bridgedRaw + nativeRaw
        const totalFloat = Number.parseFloat(formatUnits(totalBase, USDC_DECIMALS))

        return {
          raw: Number.isFinite(totalFloat) ? totalFloat : 0,
          rawBase: totalBase.toString(),
          text: Number.isFinite(totalFloat) ? totalFloat.toFixed(2) : '0.00',
          symbol: 'USDC',
          native,
          bridged,
        }
      }
      catch {
        return INITIAL_STATE
      }
    },
  })

  const pendingBalance = isQueryEnabled && data ? data : INITIAL_STATE
  const isWaitingForProxy = Boolean(isConnected && isOptionsEnabled && !proxyWalletAddress)
  const isLoadingPendingDeposit = isAwaitingConnection || isWaitingForProxy || (isQueryEnabled ? (isLoading || (!data && isFetching)) : false)
  const hasPendingDeposit = pendingBalance.rawBase !== '0'

  return {
    pendingBalance,
    hasPendingDeposit,
    isLoadingPendingDeposit,
    refetchPendingDeposit: refetch,
  }
}
