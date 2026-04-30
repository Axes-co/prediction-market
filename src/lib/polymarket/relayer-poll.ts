import { buildRelayerHeaders } from '@/lib/polymarket/relayer-auth'

export interface RelayerTransactionRecord {
  transactionID: string
  transactionHash?: string
  state: string
  from?: string
  to?: string
  proxyAddress?: string
  type?: 'SAFE' | 'PROXY' | string
}

const TERMINAL_STATES = new Set(['STATE_CONFIRMED', 'STATE_INVALID', 'STATE_FAILED'])

export function isRelayerTerminal(state: string): boolean {
  return TERMINAL_STATES.has(state)
}

export function isRelayerSuccess(state: string): boolean {
  return state === 'STATE_CONFIRMED'
}

export async function fetchRelayerTransaction(
  transactionID: string,
  signal?: AbortSignal,
): Promise<RelayerTransactionRecord | null> {
  const relayerUrl = process.env.RELAYER_URL
  if (!relayerUrl) {
    return null
  }

  const path = `/transaction?id=${encodeURIComponent(transactionID)}`
  const headers = buildRelayerHeaders('GET', `/transaction`)

  const response = await fetch(`${relayerUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    signal,
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null) as unknown
  if (!Array.isArray(payload) || payload.length === 0) {
    return null
  }

  const first = payload[0] as Partial<RelayerTransactionRecord>
  if (typeof first?.transactionID !== 'string' || typeof first?.state !== 'string') {
    return null
  }

  return {
    transactionID: first.transactionID,
    transactionHash: typeof first.transactionHash === 'string' ? first.transactionHash : undefined,
    state: first.state,
    from: typeof first.from === 'string' ? first.from : undefined,
    to: typeof first.to === 'string' ? first.to : undefined,
    proxyAddress: typeof first.proxyAddress === 'string' ? first.proxyAddress : undefined,
    type: typeof first.type === 'string' ? first.type : undefined,
  }
}

export interface PollRelayerOptions {
  timeoutMs?: number
  intervalMs?: number
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_INTERVAL_MS = 1_500

export async function pollRelayerTransaction(
  transactionID: string,
  options: PollRelayerOptions = {},
): Promise<RelayerTransactionRecord> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const deadline = Date.now() + timeoutMs

  let last: RelayerTransactionRecord | null = null
  while (Date.now() < deadline) {
    last = await fetchRelayerTransaction(transactionID, options.signal)
    if (last && isRelayerTerminal(last.state)) {
      return last
    }
    if (Date.now() + intervalMs >= deadline) {
      break
    }
    await new Promise<void>(resolve => setTimeout(resolve, intervalMs))
  }

  if (last) {
    return last
  }

  throw new Error(`Relayer transaction ${transactionID} did not resolve within ${timeoutMs}ms.`)
}

export interface SubmitResponseBody {
  transactionID?: unknown
  state?: unknown
  txHash?: unknown
}

export interface ParsedSubmitResponse {
  transactionID: string | null
  state: string | null
  legacyTxHash: string | null
}

export function parseRelayerSubmitResponse(payload: unknown): ParsedSubmitResponse {
  if (!payload || typeof payload !== 'object') {
    return { transactionID: null, state: null, legacyTxHash: null }
  }
  const body = payload as SubmitResponseBody
  const transactionID = typeof body.transactionID === 'string' ? body.transactionID : null
  const state = typeof body.state === 'string' ? body.state : null
  const legacyTxHash = typeof body.txHash === 'string' ? body.txHash : null
  return { transactionID, state, legacyTxHash }
}
