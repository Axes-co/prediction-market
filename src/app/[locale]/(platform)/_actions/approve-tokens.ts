'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { buildRelayerHeaders } from '@/lib/polymarket/relayer-auth'
import {
  isRelayerSuccess,
  parseRelayerSubmitResponse,
  pollRelayerTransaction,
} from '@/lib/polymarket/relayer-poll'
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
  transactionID?: string
  state?: string
  txHash?: string
}

const APPROVAL_POLL_TIMEOUT_MS = 60_000

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

  // The official relayer SDK reads nonce as a plain GET; signing the query
  // string can make the relayer reject otherwise-valid Safe transactions.
  const query = `address=${encodeURIComponent(user.address)}&type=SAFE`
  const path = `/nonce?${query}`

  try {
    const response = await fetch(`${relayerUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
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

    const parsed = parseRelayerSubmitResponse(payload)
    if (!parsed.transactionID) {
      // Legacy relayer (kuest) returned txHash inline. Trust it as terminal.
      const legacyHash = parsed.legacyTxHash
      let approvals
      if (request.metadata === 'approve_tokens') {
        approvals = await markTokenApprovalsCompleted(user.id)
      }
      return { error: null, approvals, txHash: legacyHash ?? undefined }
    }

    // V2 relayer: /submit returns STATE_NEW + transactionID. Poll for terminal
    // state before flipping local approval flags so DB never advances ahead of
    // the on-chain reality.
    const final = await pollRelayerTransaction(parsed.transactionID, {
      timeoutMs: APPROVAL_POLL_TIMEOUT_MS,
    }).catch((error) => {
      console.error('Relayer transaction poll failed.', error)
      return null
    })

    // Poll didn't resolve to a terminal state in time. We can't claim the
    // approvals are completed because we don't know whether the on-chain
    // call succeeded — returning a soft error keeps the UI at the prompt
    // step rather than declaring success on a still-pending transaction.
    if (!final) {
      return {
        error: 'Approval submitted to the relayer but did not confirm in time. Refresh in a minute and try again.',
        transactionID: parsed.transactionID,
        state: parsed.state ?? 'STATE_NEW',
      }
    }

    if (!isRelayerSuccess(final.state)) {
      return {
        error: 'Approval transaction failed on-chain. Please try again.',
        transactionID: parsed.transactionID,
        state: final.state,
        txHash: final.transactionHash,
      }
    }

    let approvals
    if (request.metadata === 'approve_tokens') {
      approvals = await markTokenApprovalsCompleted(user.id)
    }

    return {
      error: null,
      approvals,
      transactionID: parsed.transactionID,
      state: final.state,
      txHash: final.transactionHash,
    }
  }
  catch (error) {
    console.error('Failed to submit safe transaction', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
