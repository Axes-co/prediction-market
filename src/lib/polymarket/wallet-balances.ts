import type { Address } from 'viem'

import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
import { polygon } from 'viem/chains'
import {
  COLLATERAL_TOKEN_ADDRESS,
  NATIVE_USDC_TOKEN_ADDRESS,
  PUSD_ADDRESS,
} from '@/lib/contracts'
import 'server-only'

const USDC_DECIMALS = 6

function getPolygonRpcUrl() {
  return process.env.POLYGON_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_POLYGON_RPC_URL?.trim()
    || polygon.rpcUrls.default.http[0]
}

const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(getPolygonRpcUrl(), {
    retryCount: 1,
    timeout: 10_000,
  }),
})

export const POLYMARKET_WALLET_ASSETS = [
  { kind: 'native-usdc', address: NATIVE_USDC_TOKEN_ADDRESS, symbol: 'USDC', decimals: USDC_DECIMALS },
  { kind: 'usdce', address: COLLATERAL_TOKEN_ADDRESS, symbol: 'USDC.e', decimals: USDC_DECIMALS },
  { kind: 'pusd', address: PUSD_ADDRESS, symbol: 'pUSD', decimals: USDC_DECIMALS },
] as const

export type PolymarketWalletAssetKind = typeof POLYMARKET_WALLET_ASSETS[number]['kind']

export interface PolymarketWalletBalance {
  kind: PolymarketWalletAssetKind
  address: Address
  symbol: string
  decimals: number
  rawBase: string
  balance: string
}

export async function readErc20Balance(args: {
  token: Address
  owner: Address
}) {
  return polygonClient.readContract({
    address: args.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [args.owner],
  })
}

export async function readErc20Allowance(args: {
  token: Address
  owner: Address
  spender: Address
}) {
  return polygonClient.readContract({
    address: args.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [args.owner, args.spender],
  })
}

export async function readPolymarketWalletBalances(walletAddress: Address): Promise<PolymarketWalletBalance[]> {
  return Promise.all(
    POLYMARKET_WALLET_ASSETS.map(async (asset) => {
      const rawBase = await readErc20Balance({
        token: asset.address,
        owner: walletAddress,
      })

      return {
        kind: asset.kind,
        address: asset.address,
        symbol: asset.symbol,
        decimals: asset.decimals,
        rawBase: rawBase.toString(),
        balance: formatUnits(rawBase, asset.decimals),
      }
    }),
  )
}
