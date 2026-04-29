import { defaultNetwork } from '@/lib/appkit'
import { CTF_EXCHANGE_ADDRESS, NEG_RISK_CTF_EXCHANGE_ADDRESS } from '@/lib/contracts'

export const DEFAULT_ERROR_MESSAGE = 'Internal server error. Try again in a few moments.'
export const IS_BROWSER = typeof window !== 'undefined'

export const DEFAULT_CONDITION_PARTITION = ['1', '2'] as const

export const ORDER_SIDE = {
  BUY: 0,
  SELL: 1,
} as const

export const ORDER_TYPE = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const

export const CLOB_ORDER_TYPE = {
  FOK: 'FOK',
  FAK: 'FAK',
  GTC: 'GTC',
  GTD: 'GTD',
} as const

export const OUTCOME_INDEX = {
  YES: 0,
  NO: 1,
} as const

export const MICRO_UNIT = 1_000_000

// CLOB V2 EIP-712 domain. Verbatim from `docs.polymarket.com/v2-migration.md`.
// V1 used `name: "CTF Exchange"` / `version: "1"`. V2 cut over 2026-04-28; the
// production exchange at `clob.polymarket.com` only accepts V2 signatures.
export const EIP712_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '2',
  chainId: defaultNetwork.id,
  verifyingContract: CTF_EXCHANGE_ADDRESS,
} as const

export const NEG_RISK_EIP712_DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '2',
  chainId: defaultNetwork.id,
  verifyingContract: NEG_RISK_CTF_EXCHANGE_ADDRESS,
} as const

// V2 Order struct (11 fields). Verbatim from
// `docs.polymarket.com/v2-migration.md` "EIP-712 Order type".
//   removed from V1: taker, expiration, nonce, feeRateBps
//   added in V2:    timestamp (ms), metadata (bytes32), builder (bytes32)
// `expiration` still appears in the wire body for GTD orders, but is no
// longer part of the signed struct.
export const EIP712_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'metadata', type: 'bytes32' },
    { name: 'builder', type: 'bytes32' },
  ],
}

export function getExchangeEip712Domain(isNegRisk?: boolean) {
  return isNegRisk ? NEG_RISK_EIP712_DOMAIN : EIP712_DOMAIN
}

export const tableHeaderClass = 'px-2 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-3'
