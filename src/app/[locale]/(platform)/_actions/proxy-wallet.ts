'use server'

import type { ProxyWalletStatus } from '@/types'
import { eq } from 'drizzle-orm'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { SAFE_PROXY_FACTORY_ADDRESS } from '@/lib/contracts'
import { UserRepository } from '@/lib/db/queries/user'
import { users } from '@/lib/db/schema/auth/tables'
import { db } from '@/lib/drizzle'
import { buildRelayerHeaders } from '@/lib/polymarket/relayer-auth'
import { parseRelayerSubmitResponse } from '@/lib/polymarket/relayer-poll'
import {
  getSafeProxyWalletAddress,
  isProxyWalletDeployed,
  SAFE_PROXY_CREATE_PROXY_MESSAGE,
} from '@/lib/safe-proxy'
import {
  getTradingFlowErrorPreview,
  mapProxyWalletDeployError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'

interface SaveProxyWalletSignatureArgs {
  signature: string
}

interface SaveProxyWalletSignatureResult {
  data: {
    proxy_wallet_address: string | null
    proxy_wallet_signature: string | null
    proxy_wallet_signed_at: string | null
    proxy_wallet_status: ProxyWalletStatus | null
    proxy_wallet_tx_hash: string | null
  } | null
  error: string | null
}

export async function saveProxyWalletSignature({ signature }: SaveProxyWalletSignatureArgs): Promise<SaveProxyWalletSignatureResult> {
  const trimmedSignature = signature.trim()

  if (!trimmedSignature || !trimmedSignature.startsWith('0x')) {
    return { data: null, error: 'Invalid signature received.' }
  }

  const currentUser = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!currentUser) {
    return { data: null, error: 'Unauthenticated.' }
  }

  try {
    // V2 relayer auth is builder-level (server env `POLYMARKET_BUILDER_*`),
    // not per-user. The per-user `tradingAuth.relayer` left over from V1
    // onboarding stays a no-op here. `triggerSafeProxyDeployment` and
    // `submitSafeTransactionAction` derive their headers from
    // `buildRelayerHeaders()` directly.
    const proxyAddress = currentUser.proxy_wallet_address
      ? currentUser.proxy_wallet_address as `0x${string}`
      : await getSafeProxyWalletAddress(currentUser.address as `0x${string}`)
    let proxyIsDeployed = await isProxyWalletDeployed(proxyAddress)
    let txHash: string | null = currentUser.proxy_wallet_tx_hash ?? null
    if (!proxyIsDeployed) {
      txHash = await triggerSafeProxyDeployment({
        owner: currentUser.address,
        signature: trimmedSignature,
        proxyWallet: proxyAddress,
      })
      proxyIsDeployed = await isProxyWalletDeployed(proxyAddress)
    }

    let nextStatus: ProxyWalletStatus = 'signed'
    if (proxyIsDeployed) {
      nextStatus = 'deployed'
      txHash = null
    }
    else if (txHash) {
      nextStatus = 'deploying'
    }

    const [updated] = await db
      .update(users)
      .set({
        proxy_wallet_signature: trimmedSignature,
        proxy_wallet_address: proxyAddress,
        proxy_wallet_signed_at: new Date(),
        proxy_wallet_status: nextStatus,
        proxy_wallet_tx_hash: txHash,
      })
      .where(eq(users.id, currentUser.id))
      .returning({
        proxy_wallet_address: users.proxy_wallet_address,
        proxy_wallet_signature: users.proxy_wallet_signature,
        proxy_wallet_signed_at: users.proxy_wallet_signed_at,
        proxy_wallet_status: users.proxy_wallet_status,
        proxy_wallet_tx_hash: users.proxy_wallet_tx_hash,
      })

    if (!updated) {
      return { data: null, error: DEFAULT_ERROR_MESSAGE }
    }

    return {
      data: {
        proxy_wallet_address: updated.proxy_wallet_address,
        proxy_wallet_signature: updated.proxy_wallet_signature,
        proxy_wallet_signed_at: updated.proxy_wallet_signed_at?.toISOString() ?? null,
        proxy_wallet_status: updated.proxy_wallet_status as ProxyWalletStatus | null,
        proxy_wallet_tx_hash: updated.proxy_wallet_tx_hash,
      },
      error: null,
    }
  }
  catch (error) {
    console.error('Failed to save proxy wallet signature', error)
    const message = error instanceof Error && error.message ? error.message : DEFAULT_ERROR_MESSAGE
    return { data: null, error: message }
  }
}

/**
 * Polymarket V2 Safe deployment flow. Verbatim mirror of
 * `@polymarket/builder-relayer-client@0.0.6/dist/builder/create.js` +
 * `dist/client.js`. The relayer's `/wallet/safe` endpoint that kuest used is
 * **not present on V2** (404). V2 deployment is a `SAFE_CREATE` transaction
 * submitted through the unified `/submit` endpoint, authed with builder
 * credentials (server-level, `POLY_BUILDER_*` headers — not per-user L2).
 *
 * The user's authorization is the EIP-712 signature over `CreateProxy(
 *   paymentToken, payment, paymentReceiver
 * )` against the domain `{ name: "Polymarket Contract Proxy Factory",
 * chainId: 137, verifyingContract: <factory> }`. The signature lives in the
 * request body, not the headers.
 */
async function triggerSafeProxyDeployment({
  owner,
  signature,
  proxyWallet,
}: {
  owner: string
  signature: string
  proxyWallet: string
}) {
  const relayerUrl = process.env.RELAYER_URL!
  const method = 'POST'
  const path = '/submit'

  const payload = {
    from: owner,
    to: SAFE_PROXY_FACTORY_ADDRESS,
    proxyWallet,
    data: '0x',
    signature,
    signatureParams: {
      paymentToken: SAFE_PROXY_CREATE_PROXY_MESSAGE.paymentToken,
      payment: SAFE_PROXY_CREATE_PROXY_MESSAGE.payment.toString(),
      paymentReceiver: SAFE_PROXY_CREATE_PROXY_MESSAGE.paymentReceiver,
    },
    // Polymarket V2 relayer enum: the TypeScript key is `SAFE_CREATE` but the
    // wire value is `"SAFE-CREATE"` (hyphen). Verbatim from
    // `@polymarket/builder-relayer-client@0.0.6/dist/types.js`:
    //   TransactionType["SAFE_CREATE"] = "SAFE-CREATE";
    // Sending `"SAFE_CREATE"` (underscore) gets rejected upstream as 400 "bad request".
    type: 'SAFE-CREATE',
  }

  const body = JSON.stringify(payload)
  const builderHeaders = buildRelayerHeaders(method, path, body)

  const response = await fetch(`${relayerUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...builderHeaders,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  const {
    payload: responsePayload,
    rawError,
    contentType,
  } = await readTradingFlowErrorResponse(response)

  if (!response.ok) {
    console.error('Safe proxy deployment request failed.', {
      status: response.status,
      contentType,
      rawError: getTradingFlowErrorPreview(rawError),
    })

    const message = mapProxyWalletDeployError(rawError, {
      status: response.status,
      contentType,
    })
    throw new Error(message)
  }

  if (!responsePayload) {
    console.error('Safe proxy deployment returned an invalid response payload.', {
      status: response.status,
      contentType,
      rawError: getTradingFlowErrorPreview(rawError),
    })
    throw new Error(mapProxyWalletDeployError(rawError, {
      status: response.status,
      contentType,
      forceFallback: true,
    }))
  }

  // V2 /submit returns `{ transactionID, state: "STATE_NEW" }` — the onchain
  // tx hash is only available later via GET /transaction. Track the
  // transactionID for status polling; on-chain `getCode(proxyAddress)` remains
  // the source of truth for the "deployed" status flip.
  const parsed = parseRelayerSubmitResponse(responsePayload)
  return parsed.transactionID ?? parsed.legacyTxHash
}
