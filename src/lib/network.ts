import { defaultNetwork } from '@/lib/appkit'

export const POLYGON_MAINNET_CHAIN_ID = 137

export const AMOY_CHAIN_ID = 80_002

// Defaults to false now that `defaultNetwork` is `polygon` (V2.1.5). Kept as a
// runtime check so flipping `defaultNetwork` back to Amoy in dev re-enables
// the test-mode banner + USDC.e branches without a second edit.
export const IS_TEST_MODE = (defaultNetwork.id as number) === AMOY_CHAIN_ID

export const POLYGON_SCAN_BASE = IS_TEST_MODE
  ? 'https://amoy.polygonscan.com'
  : 'https://polygonscan.com'
