'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { buildRelayerHeaders } from '@/lib/polymarket/relayer-auth'
import { markTokenApprovalsCompleted } from '@/lib/trading-auth/server'
import {
  getTradingFlowErrorPreview,
  mapApproveTokensError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'

interface SafeNonceResult {
  error: string | null
  nonce?: string
}

interface SubmitSafeTransactionResult {
  error: string | null
  approvals?: {
    enabled: boolean
    updatedAt: string
  }
  txHash?: string
}

export async function getSafeNonceAction(): Promise<SafeNonceResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before approving tokens.' }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  // V2 relayer auth is server-level builder credentials, not per-user. The
  // Safe nonce read is itself unauthenticated (returns nonce from chain), but
  // the SDK signs it for parity with the rest of the relayer surface.
  const query = `address=${encodeURIComponent(user.address)}&type=SAFE`
  const path = `/nonce?${query}`

  try {
    const builderHeaders = buildRelayerHeaders('GET', path)
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...builderHeaders,
      },
      signal: AbortSignal.timeout(10_000),
    })

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || typeof payload?.nonce !== 'string') {
      console.error('Failed to fetch safe nonce response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const message = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
      return { error: message }
    }

    return { error: null, nonce: payload.nonce }
  }
  catch (error) {
    console.error('Failed to fetch safe nonce', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}

export async function submitSafeTransactionAction(request: SafeTransactionRequestPayload): Promise<SubmitSafeTransactionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet first.' }
  }

  if (request.type !== 'SAFE') {
    return { error: 'Invalid transaction type.' }
  }

  if (request.from.toLowerCase() !== user.address.toLowerCase()) {
    return { error: 'Signer mismatch.' }
  }

  if (request.proxyWallet.toLowerCase() !== user.proxy_wallet_address.toLowerCase()) {
    return { error: 'Proxy wallet mismatch.' }
  }

  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  const path = '/submit'
  const body = JSON.stringify(request)
  const builderHeaders = buildRelayerHeaders('POST', path, body)

  try {
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...builderHeaders,
      },
      body,
      signal: AbortSignal.timeout(15000),
    })

    const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
    if (!response.ok || !payload) {
      console.error('Failed to submit safe transaction response.', {
        status: response.status,
        contentType,
        rawError: getTradingFlowErrorPreview(rawError),
      })
      const message = mapApproveTokensError(rawError, {
        status: response.status,
        contentType,
        forceFallback: response.ok,
      })
      return { error: message }
    }

    let approvals
    if (request.metadata === 'approve_tokens') {
      approvals = await markTokenApprovalsCompleted(user.id)
    }

    const txHash = typeof payload?.txHash === 'string'
      ? payload.txHash
      : typeof payload?.tx_hash === 'string'
        ? payload.tx_hash
        : typeof payload?.transactionHash === 'string'
          ? payload.transactionHash
          : typeof payload?.hash === 'string'
            ? payload.hash
            : undefined

    return { error: null, approvals, txHash }
  }
  catch (error) {
    console.error('Failed to submit safe transaction', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
