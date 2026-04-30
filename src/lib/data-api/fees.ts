export interface FeeReceiverTotal {
  exchange: string
  receiver: string
  tokenId: string
  totalAmount: string
  totalVolume: string
  updatedAt: number
}

interface FeeReceiverTotalsParams {
  endpoint: 'referrers'
  address: string
  exchange?: string
  tokenId?: string
  limit?: number
  offset?: number
}

export async function fetchFeeReceiverTotals(_params: FeeReceiverTotalsParams): Promise<FeeReceiverTotal[]> {
  // The Polymarket Data API does not document a `/referrers` endpoint
  // (`https://docs.polymarket.com/api-reference/data-api-openapi.yaml`).
  // Internal Axes referral attribution is tracked locally only; partnership
  // economics flow through the official `builder` field on signed orders and
  // are reported via the documented `/v1/builders/leaderboard` and
  // `/v1/builders/volume` endpoints. Until those views are wired, this call
  // returns an empty list so admin/affiliate pages render a clean zero state
  // instead of failing.
  return []
}

export function sumFeeTotals(totals: FeeReceiverTotal[]): bigint {
  return totals.reduce((acc, total) => {
    try {
      return acc + BigInt(total.totalAmount)
    }
    catch {
      return acc
    }
  }, 0n)
}

export function sumFeeVolumes(totals: FeeReceiverTotal[]): bigint {
  return totals.reduce((acc, total) => {
    try {
      return acc + BigInt(total.totalVolume)
    }
    catch {
      return acc
    }
  }, 0n)
}

export function baseUnitsToNumber(amount: bigint, decimals = 6): number {
  if (decimals <= 0) {
    return Number(amount)
  }
  return Number(amount) / 10 ** decimals
}
