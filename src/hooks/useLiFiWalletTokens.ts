import type { ChainId, ExtendedChain, TokensExtendedResponse, WalletTokenExtended } from '@lifi/types'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, formatUnits, http } from 'viem'
import { defaultNetwork } from '@/lib/appkit'
import { COLLATERAL_TOKEN_ADDRESS, NATIVE_USDC_TOKEN_ADDRESS } from '@/lib/contracts'

export const LIFI_WALLET_TOKENS_QUERY_KEY = 'lifi-wallet-tokens'
export const POLYGON_DIRECT_DEPOSIT_METHOD = 'polygon-usdc-direct'

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const MIN_USD_BALANCE = 2

function buildAcceptedTokenMap(tokensResponse: TokensExtendedResponse) {
  const acceptedByChain = new Map<number, Set<string>>()

  for (const [chainIdKey, tokens] of Object.entries(tokensResponse.tokens)) {
    const chainId = Number(chainIdKey)
    const accepted = new Set<string>()

    for (const token of tokens) {
      accepted.add(token.address.toLowerCase())
    }

    acceptedByChain.set(chainId, accepted)
  }

  return acceptedByChain
}

function buildChainMap(chains: ExtendedChain[]) {
  const chainMap = new Map<number, ExtendedChain>()
  for (const chain of chains) {
    chainMap.set(chain.id as number, chain)
  }
  return chainMap
}

function normalizeAmount(token: WalletTokenExtended) {
  try {
    const decimals = Number(token.decimals)
    if (!Number.isFinite(decimals)) {
      return 0
    }
    const amount = BigInt(token.amount)
    return Number(formatUnits(amount, decimals))
  }
  catch {
    return 0
  }
}

function toUsdValue(token: WalletTokenExtended) {
  const priceUsd = Number(token.priceUSD ?? 0)

  if (!Number.isFinite(priceUsd)) {
    return 0
  }

  const normalizedAmount = normalizeAmount(token)
  return normalizedAmount * priceUsd
}

function formatTokenAmount(token: WalletTokenExtended) {
  const normalizedAmount = normalizeAmount(token)

  return normalizedAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

export interface LiFiWalletTokenItem {
  id: string
  chainId: number
  address: string
  decimals: number
  symbol: string
  network: string
  icon: string
  chainIcon?: string
  balance: string
  balanceRaw: number
  usd: string
  usdValue: number
  disabled: boolean
  depositMethod: 'lifi' | typeof POLYGON_DIRECT_DEPOSIT_METHOD
}

interface UseLiFiWalletTokensOptions {
  enabled?: boolean
}

const USDC_DECIMALS = 6
const POLYGON_USDC_ICON = '/images/deposit/transfer/usdc_dark.png'
const POLYGON_CHAIN_ICON = '/images/deposit/transfer/polygon_dark.png'
const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const polygonClient = createPublicClient({
  chain: defaultNetwork,
  transport: http(defaultNetwork.rpcUrls.default.http[0]),
})

function buildWalletTokenId(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`
}

async function readDirectPolygonUsdcItems(walletAddress: string): Promise<LiFiWalletTokenItem[]> {
  const assets = Array.from(new Map([
    [NATIVE_USDC_TOKEN_ADDRESS.toLowerCase(), { address: NATIVE_USDC_TOKEN_ADDRESS, symbol: 'USDC' }],
    [COLLATERAL_TOKEN_ADDRESS.toLowerCase(), { address: COLLATERAL_TOKEN_ADDRESS, symbol: 'USDC.e' }],
  ]).values())

  const balances = await Promise.all(
    assets.map(async (asset) => {
      const rawBase = await polygonClient.readContract({
        address: asset.address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      }) as bigint
      return { ...asset, rawBase }
    }),
  )

  return balances.flatMap((asset) => {
    if (asset.rawBase <= 0n) {
      return []
    }

    const balanceRaw = Number(formatUnits(asset.rawBase, USDC_DECIMALS))
    if (!Number.isFinite(balanceRaw) || balanceRaw <= 0) {
      return []
    }

    return [{
      id: buildWalletTokenId(defaultNetwork.id, asset.address),
      chainId: defaultNetwork.id,
      address: asset.address,
      decimals: USDC_DECIMALS,
      symbol: asset.symbol,
      network: 'Polygon',
      icon: POLYGON_USDC_ICON,
      chainIcon: POLYGON_CHAIN_ICON,
      balance: balanceRaw.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }),
      balanceRaw,
      usd: USD_FORMATTER.format(balanceRaw),
      usdValue: balanceRaw,
      disabled: balanceRaw < MIN_USD_BALANCE,
      depositMethod: POLYGON_DIRECT_DEPOSIT_METHOD,
    }]
  })
}

export function useLiFiWalletTokens(walletAddress?: string | null, options: UseLiFiWalletTokensOptions = {}) {
  const isEnabled = Boolean(options.enabled ?? true)
  const hasAddress = Boolean(walletAddress)

  const query = useQuery({
    queryKey: [LIFI_WALLET_TOKENS_QUERY_KEY, walletAddress],
    enabled: isEnabled && hasAddress,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    queryFn: async (): Promise<LiFiWalletTokenItem[]> => {
      if (!walletAddress) {
        return []
      }

      const directPolygonUsdcItemsPromise = readDirectPolygonUsdcItems(walletAddress).catch(() => [])

      try {
        const [tokensResult, balancesResult, chainsResult] = await Promise.all([
          fetch('/api/lifi/tokens', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          }),
          fetch('/api/lifi/balances', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
          }),
          fetch('/api/lifi/chains'),
        ])

        if (!tokensResult.ok || !balancesResult.ok || !chainsResult.ok) {
          return directPolygonUsdcItemsPromise
        }

        const tokensJson = await tokensResult.json()
        const balancesJson = await balancesResult.json()
        const chainsJson = await chainsResult.json()
        const tokensResponse = tokensJson.tokens as TokensExtendedResponse
        const balancesByChain = balancesJson.balances as Record<number, WalletTokenExtended[]>
        const chains = chainsJson.chains as ExtendedChain[]

        const acceptedByChain = buildAcceptedTokenMap(tokensResponse)
        const chainMap = buildChainMap(chains)
        const itemsById = new Map<string, LiFiWalletTokenItem>()

        for (const [chainIdKey, walletTokens] of Object.entries(balancesByChain)) {
          const chainId = Number(chainIdKey) as ChainId
          const acceptedTokens = acceptedByChain.get(chainId)

          if (!acceptedTokens) {
            continue
          }

          const chain = chainMap.get(chainId)
          const networkName = chain?.name ?? `Chain ${chainId}`
          const networkIcon = chain?.logoURI

          for (const token of walletTokens) {
            if (!acceptedTokens.has(token.address.toLowerCase())) {
              continue
            }

            const usdValue = toUsdValue(token)
            if (!Number.isFinite(usdValue) || usdValue <= 0) {
              continue
            }

            const id = buildWalletTokenId(chainId, token.address)
            itemsById.set(id, {
              id,
              chainId,
              address: token.address,
              decimals: Number(token.decimals),
              symbol: token.symbol,
              network: networkName,
              icon: token.logoURI ?? '/images/deposit/transfer/usdc_dark.png',
              chainIcon: networkIcon,
              balance: formatTokenAmount(token),
              balanceRaw: normalizeAmount(token),
              usd: USD_FORMATTER.format(usdValue),
              usdValue,
              disabled: usdValue < MIN_USD_BALANCE,
              depositMethod: 'lifi',
            })
          }
        }

        const directPolygonUsdcItems = await directPolygonUsdcItemsPromise
        for (const item of directPolygonUsdcItems) {
          // Prefer the direct same-chain USDC transfer path for Polygon USDC.
          // It avoids LI.FI metadata/quote gaps and matches the Polymarket
          // Safe builder example's native Polygon funding model.
          itemsById.set(item.id, item)
        }

        const items = Array.from(itemsById.values())
        items.sort((a, b) => b.usdValue - a.usdValue)

        return items
      }
      catch {
        return directPolygonUsdcItemsPromise
      }
    },
  })

  return {
    items: query.data ?? [],
    isLoadingTokens: query.isLoading || (query.isFetching && query.data === undefined),
    refetchTokens: query.refetch,
  }
}
