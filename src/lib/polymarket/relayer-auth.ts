import { buildClobHmacSignature } from '@/lib/hmac'

/**
 * Builder-level HMAC headers for the Polymarket V2 relayer.
 *
 * Per `@polymarket/builder-relayer-client/dist/client.js` and the
 * `wagmi-safe-builder-example/app/api/polymarket/sign/route.ts` reference
 * implementation, the V2 relayer authenticates with **builder credentials**
 * (server-level), not per-user L2 credentials. The user's authorization is
 * the EIP-712 signature embedded in the request body (`CreateProxy` for
 * SAFE_CREATE, `SafeTx` for SAFE).
 *
 * Credentials live in `.env.local` as `POLYMARKET_BUILDER_API_KEY`,
 * `POLYMARKET_BUILDER_SECRET`, `POLYMARKET_BUILDER_PASSPHRASE` (already
 * configured for our builder profile at
 * `polymarket.com/settings?tab=builder`). The HMAC algorithm is byte-identical
 * to the CLOB HMAC (`buildClobHmacSignature`); only the **header names**
 * change from `POLY_*` to `POLY_BUILDER_*`.
 */
export interface RelayerHeaders {
  POLY_BUILDER_API_KEY: string
  POLY_BUILDER_PASSPHRASE: string
  POLY_BUILDER_SIGNATURE: string
  POLY_BUILDER_TIMESTAMP: string
}

export class RelayerAuthMissingError extends Error {
  constructor() {
    super('Polymarket builder relayer credentials are not configured. Set POLYMARKET_BUILDER_API_KEY / POLYMARKET_BUILDER_SECRET / POLYMARKET_BUILDER_PASSPHRASE in env.')
    this.name = 'RelayerAuthMissingError'
  }
}

export function buildRelayerHeaders(method: string, path: string, body?: string): RelayerHeaders {
  const key = process.env.POLYMARKET_BUILDER_API_KEY
  const secret = process.env.POLYMARKET_BUILDER_SECRET
  const passphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE
  if (!key || !secret || !passphrase) {
    throw new RelayerAuthMissingError()
  }

  // Polymarket V2 relayer uses **milliseconds** for `POLY_BUILDER_TIMESTAMP`,
  // not seconds. Per `@polymarket/builder-signing-sdk` reference example
  // (`wagmi-safe-builder-example/app/api/polymarket/sign/route.ts:38`):
  //   `const sigTimestamp = Date.now().toString();`
  // Sending seconds drifts the timestamp ~1000x off the relayer clock and
  // is rejected upstream as a generic 400 "bad request".
  const timestamp = Date.now()
  const signature = buildClobHmacSignature(secret, timestamp, method, path, body)

  return {
    POLY_BUILDER_API_KEY: key,
    POLY_BUILDER_PASSPHRASE: passphrase,
    POLY_BUILDER_SIGNATURE: signature,
    POLY_BUILDER_TIMESTAMP: timestamp.toString(),
  }
}
