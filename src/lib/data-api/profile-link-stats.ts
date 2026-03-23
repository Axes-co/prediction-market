import { cacheKeys, cacheTTL, withCache } from '@/lib/redis'
import { normalizeAddress } from '@/lib/wallet'

export interface ProfileLinkStats {
  profitLoss: number
  volume: string | null
  positionsValue: number
}

const DATA_API_URL = process.env.DATA_URL!
const LEADERBOARD_API_URL = DATA_API_URL.endsWith('/v1') ? DATA_API_URL : `${DATA_API_URL}/v1`

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parsePortfolioValue(body: unknown): number {
  if (!body) {
    return 0
  }

  if (Array.isArray(body)) {
    return toNumber(body[0]?.value ?? body[0]) ?? 0
  }

  if (typeof body === 'object' && body !== null && 'value' in body) {
    return toNumber((body as { value?: unknown }).value) ?? 0
  }

  return toNumber(body) ?? 0
}

function parseVolume(body: unknown): string | null {
  if (!body) {
    return null
  }

  if (typeof body === 'object') {
    const candidate = body as {
      volume?: unknown
      total_volume?: unknown
      totalVolume?: unknown
      tradedVolume?: unknown
    }
    const resolved = candidate.volume
      ?? candidate.total_volume
      ?? candidate.totalVolume
      ?? candidate.tradedVolume
    return parseVolumeValue(resolved)
  }

  return parseVolumeValue(body)
}

function parseVolumeValue(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  return null
}

function parseLeaderboardPnl(body: unknown): number | null {
  if (!body) {
    return null
  }

  function resolveEntry(entry: unknown): number | null {
    if (!entry || typeof entry !== 'object') {
      return null
    }
    return toNumber((entry as { pnl?: unknown }).pnl)
  }

  if (Array.isArray(body)) {
    return resolveEntry(body[0]) ?? null
  }

  if (typeof body === 'object') {
    const data = (body as { data?: unknown }).data
    if (Array.isArray(data)) {
      return resolveEntry(data[0]) ?? null
    }
    const leaderboard = (body as { leaderboard?: unknown }).leaderboard
    if (Array.isArray(leaderboard)) {
      return resolveEntry(leaderboard[0]) ?? null
    }
  }

  return null
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return await response.json()
}

async function fetchProfileLinkStatsFromApi(
  address: string,
  signal?: AbortSignal,
): Promise<ProfileLinkStats | null> {
  try {
    const valueUrl = `${DATA_API_URL}/value?user=${encodeURIComponent(address)}`
    const volumeUrl = `${DATA_API_URL}/volume?user=${encodeURIComponent(address)}`
    const leaderboardParams = new URLSearchParams({
      user: address,
      timePeriod: 'all',
      orderBy: 'PNL',
      category: 'overall',
      limit: '1',
      offset: '0',
    })
    const leaderboardUrl = `${LEADERBOARD_API_URL}/leaderboard?${leaderboardParams.toString()}`

    const [
      valueResult,
      volumeResult,
      leaderboardResult,
    ] = await Promise.allSettled([
      fetchJson(valueUrl, signal),
      fetchJson(volumeUrl, signal),
      fetchJson(leaderboardUrl, signal),
    ])

    const volume = volumeResult.status === 'fulfilled'
      ? parseVolume(volumeResult.value)
      : null

    const positionsValue = valueResult.status === 'fulfilled'
      ? parsePortfolioValue(valueResult.value)
      : 0

    const leaderboardPnl = leaderboardResult.status === 'fulfilled'
      ? parseLeaderboardPnl(leaderboardResult.value)
      : null

    return {
      profitLoss: leaderboardPnl ?? 0,
      volume,
      positionsValue,
    }
  }
  catch (error) {
    console.error('Failed to fetch profile link stats', error)
    return null
  }
}

export async function fetchProfileLinkStats(
  userAddress?: string | null,
  signal?: AbortSignal,
): Promise<ProfileLinkStats | null> {
  if (!DATA_API_URL) {
    return null
  }

  const address = normalizeAddress(userAddress)
  if (!address) {
    return null
  }

  return withCache(
    cacheKeys.profileStats(address.toLowerCase()),
    () => fetchProfileLinkStatsFromApi(address, signal),
    cacheTTL.profileStats,
  )
}
