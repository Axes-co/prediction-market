'use server'

import type { SafeTransactionRequestPayload } from '@/lib/safe/transactions'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import { buildOnrampWrapTransaction } from '@/lib/polymarket/onramp'
import { buildRelayerHeaders } from '@/lib/polymarket/relayer-auth'

/**
 * Pending-deposit flow for Polymarket V2.
 *
 * V1 (kuest) wrapped USDC.e via the relayer's `/swap/usdc-e/build` +
 * `/swap/usdc-e/submit` endpoints. Polymarket V2 has no equivalent: the
 * V2 deposit path is `Onramp.wrap()` called from the user's Safe, with the
 * Safe-tx submitted through the relayer's generic `/submit` endpoint.
 *
 * The frontend (`PendingDepositBanner.tsx`) signs the Safe-tx typed data
 * locally with the EOA via wagmi, so the build step here just produces the
 * raw transaction + nonce — no remote build call is needed because
 * `Onramp.wrap()` calldata is fully deterministic on our side.
 */

export interface PendingDepositBuildResponse {
  nonce: string
  transaction: {
    to: string
    value: string
    data: string
    operation: number
  }
  signatureParams: {
    gasPrice: string
    operation: string
    safeTxnGas: string
    baseGas: string
    gasToken: string
    refundReceiver: string
  }
  amountIn: string
  amountOutMinimum: string
  fee: number
  deadline: number
}

interface BuildPendingDepositResult {
  error: string | null
  payload?: PendingDepositBuildResponse
}

interface SubmitPendingDepositResult {
  error: string | null
  txHash?: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function fetchSafeNonce(args: { userAddress: string }): Promise<string | null> {
  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return null
  }
  const path = `/nonce?address=${encodeURIComponent(args.userAddress)}&type=SAFE`
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
    if (!response.ok) {
      return null
    }
    const payload = await response.json().catch(() => null)
    return typeof payload?.nonce === 'string' ? payload.nonce : null
  }
  catch (error) {
    console.error('Failed to fetch safe nonce', error)
    return null
  }
}

/**
 * Build the unsigned Safe-tx that wraps the user's pending USDC.e balance
 * into pUSD via the Polymarket Collateral Onramp. The frontend signs the
 * returned typed data with the user's EOA and passes the result back to
 * `submitPendingUsdcSwapAction`.
 */
export async function buildPendingUsdcSwapAction(params: {
  amount: string
  slippageBps?: number
}): Promise<BuildPendingDepositResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.' }
  }

  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet first.' }
  }

  if (!process.env.RELAYER_URL) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  let amountBaseUnits: bigint
  try {
    amountBaseUnits = BigInt(params.amount)
  }
  catch {
    return { error: 'Invalid deposit amount.' }
  }
  if (amountBaseUnits <= 0n) {
    return { error: 'Deposit amount must be positive.' }
  }

  const nonce = await fetchSafeNonce({ userAddress: user.address })
  if (nonce == null) {
    return { error: DEFAULT_ERROR_MESSAGE }
  }

  // Local Safe-tx build — `Onramp.wrap(USDC.e, Safe, amount)`.
  const tx = buildOnrampWrapTransaction({
    recipient: user.proxy_wallet_address as `0x${string}`,
    amountBaseUnits,
  })

  return {
    error: null,
    payload: {
      nonce,
      transaction: {
        to: tx.to,
        value: tx.value,
        data: tx.data,
        operation: tx.operation,
      },
      // Mirrors the zero-defaults `getSafeTxTypedData` produces locally.
      signatureParams: {
        gasPrice: '0',
        operation: `${tx.operation}`,
        safeTxnGas: '0',
        baseGas: '0',
        gasToken: ZERO_ADDRESS,
        refundReceiver: ZERO_ADDRESS,
      },
      // Wrap is 1:1 USDC.e → pUSD with no fee or deadline. These fields stay
      // on the response shape for back-compat with the existing UI which
      // displays them (will read 0 fee).
      amountIn: amountBaseUnits.toString(),
      amountOutMinimum: amountBaseUnits.toString(),
      fee: 0,
      deadline: 0,
    },
  }
}

/**
 * Forward the user-signed Safe-tx to the V2 relayer's `/submit` endpoint.
 * Mirrors `submitSafeTransactionAction` in `_actions/approve-tokens.ts`; kept
 * here as a thin wrapper so the deposit-flow caller doesn't have to know
 * about the approval-action module.
 */
export async function submitPendingUsdcSwapAction(
  request: SafeTransactionRequestPayload,
): Promise<SubmitPendingDepositResult> {
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
      signal: AbortSignal.timeout(20000),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : DEFAULT_ERROR_MESSAGE
      return { error: message }
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

    return { error: null, txHash }
  }
  catch (error) {
    console.error('Failed to submit pending deposit swap', error)
    return { error: DEFAULT_ERROR_MESSAGE }
  }
}
