import type { TypedDataDomain } from 'viem'
import type { SignTypedDataParameters } from 'wagmi/actions'
import type { BlockchainOrder } from '@/types'
import { EIP712_TYPES } from '@/lib/constants'

type SignTypedDataFn = (args: SignTypedDataParameters) => Promise<string>

export interface SignOrderArgs {
  payload: BlockchainOrder
  domain: TypedDataDomain
  signTypedDataAsync: SignTypedDataFn
}

/**
 * Signs the V2 11-field Order struct via EIP-712. The shape mirrors
 * `EIP712_TYPES.Order` in `src/lib/constants.ts` exactly. V1-only fields
 * (`taker`, `expiration`, `nonce`, `feeRateBps`) are intentionally omitted
 * here even though they still live on `BlockchainOrder` for back-compat with
 * `serializeOrder` and the V1 wire body during the V2.1 → V2.2 transition —
 * viem ignores message keys that aren't named in the types schema, but being
 * explicit avoids accidental coupling.
 */
export async function signOrderPayload({
  payload,
  domain,
  signTypedDataAsync,
}: SignOrderArgs) {
  return await signTypedDataAsync({
    domain,
    types: EIP712_TYPES,
    primaryType: 'Order',
    message: {
      salt: payload.salt,
      maker: payload.maker,
      signer: payload.signer,
      tokenId: payload.token_id,
      makerAmount: payload.maker_amount,
      takerAmount: payload.taker_amount,
      side: payload.side,
      signatureType: payload.signature_type,
      timestamp: payload.timestamp,
      metadata: payload.metadata,
      builder: payload.builder,
    },
  })
}
