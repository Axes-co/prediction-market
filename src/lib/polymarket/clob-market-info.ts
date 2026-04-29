/**
 * Wrapper for `GET /clob-markets/{condition_id}` on the Polymarket V2 CLOB.
 *
 * Documented at `docs.polymarket.com/api-reference/markets/get-clob-market-info.md`.
 * Returns "all CLOB-level parameters for a market in a single call" — tokens,
 * tick size, min order size, fee details, rewards.
 *
 * Used by the order panel to show the correct minimum tick and minimum order
 * size for the active market (V2 markets can carry different values), and by
 * the fee preview to render the protocol-set fee rate before submission.
 */

const DEFAULT_BASE_URL = 'https://clob.polymarket.com'
const REQUEST_TIMEOUT_MS = 5_000

export interface ClobMarketToken {
  /** Token id (uint256 stringified). */
  t: string
  /** Outcome label, e.g. `"Yes"` / `"No"` or a multi-outcome string. */
  o: string
}

export interface ClobMarketFeeDetails {
  /** Fee rate. e.g. 0.072. Combined with `e` to derive bps. */
  r: number
  /** Exponent. */
  e: number
  /** True if only takers pay the fee. V2 default is taker-only. */
  to: boolean
}

export interface ClobMarketInfo {
  /** Condition id, echoed for caller convenience. */
  c: string
  /** Token list (typically 2 entries: yes + no). */
  t: ClobMarketToken[]
  /** Minimum tick size (price increment), e.g. 0.01. */
  mts: number
  /** Minimum order size (collateral base units interpreted by the matcher). */
  mos: number
  /** Maker base fee, basis points. */
  mbf: number
  /** Taker base fee, basis points. */
  tbf: number
  /** True when the market is currently accepting orders. */
  ao: boolean
  /** Accepting-order timestamp. */
  aot?: string
  /** RFQ enabled flag. */
  rfqe?: boolean
  /** Order delay enabled. */
  itode?: boolean
  /** Blockaid check enabled. */
  ibce?: boolean
  /** Minimum order age (seconds). */
  oas?: number
  /** Fee details object. */
  fd: ClobMarketFeeDetails
  /** Rewards configuration. Optional — present on rewarded markets only. */
  r?: Record<string, unknown>
}

export class ClobMarketInfoError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ClobMarketInfoError'
  }
}

interface FetchOptions {
  baseUrl?: string
  signal?: AbortSignal
}

/**
 * Fetch the V2 CLOB market info for a given condition id. Throws
 * `ClobMarketInfoError` on a non-2xx response so the caller can branch on
 * `status` (404 → market not registered, 5xx → transient).
 */
export async function getClobMarketInfo(
  conditionId: string,
  options?: FetchOptions,
): Promise<ClobMarketInfo> {
  const trimmed = conditionId.trim()
  if (!/^0x[a-f0-9]{64}$/i.test(trimmed)) {
    throw new ClobMarketInfoError(400, 'condition id must be 0x-prefixed 32-byte hex')
  }

  const baseUrl = (options?.baseUrl ?? process.env.CLOB_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const externalSignal = options?.signal
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(`${baseUrl}/clob-markets/${trimmed}`, { signal })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ClobMarketInfoError(response.status, text || `HTTP ${response.status}`)
  }
  return await response.json() as ClobMarketInfo
}

/**
 * Convenience: returns the maker fee rate as a decimal (e.g. 0.001 for 10 bps).
 * V2 sets fees per-market at match time; reading from `fd.r` is the canonical
 * source.
 */
export function effectiveMakerFeeRate(info: ClobMarketInfo): number {
  return info.fd.r
}

/**
 * Convenience: returns true when only takers pay the protocol fee on this
 * market (the V2 default per `docs.polymarket.com/concepts/fees.md`).
 */
export function isTakerOnlyMarket(info: ClobMarketInfo): boolean {
  return info.fd.to === true
}
