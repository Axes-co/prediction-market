import type { AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { polygon } from '@reown/appkit/networks'

export const projectId = process.env.REOWN_APPKIT_PROJECT_ID ?? ''

// Polygon mainnet (chain id 137). Polymarket V2 went production-only on
// 2026-04-28; there is no testnet equivalent of clob.polymarket.com or its
// V2 contracts, so trading + EIP-712 signing must target mainnet. The
// previous polygonAmoy default was a kuest-fork holdover.
export const defaultNetwork = polygon
export const networks = [defaultNetwork] as [AppKitNetwork, ...AppKitNetwork[]]

export const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  projectId,
  networks,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
