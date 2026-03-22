/**
 * Server-side SVG chart rendering utilities for embed widgets.
 *
 * Converts price history data into SVG path strings and axis labels
 * without requiring any client-side charting library.
 */

import {
  CHART_AXIS_TICK_COUNT,
  CHART_PADDING,
} from '@/lib/embed-dimensions'
import { clampPrice } from '@/lib/embed-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedPricePoint {
  /** Unix timestamp in seconds */
  t: number
  /** Price 0–1 */
  p: number
}

export interface EmbedChartSeries {
  key: string
  color: string
  points: EmbedPricePoint[]
}

export interface EmbedChartLine {
  key: string
  color: string
  pathD: string
  lastX: number
  lastY: number
  lastPercent: number
}

export interface EmbedAxisTick {
  y: number
  label: string
}

export interface EmbedChartData {
  lines: EmbedChartLine[]
  axisTicks: EmbedAxisTick[]
  viewBoxWidth: number
  viewBoxHeight: number
}

// ---------------------------------------------------------------------------
// Price history fetching (server-side only)
// ---------------------------------------------------------------------------

interface PriceHistoryResponse {
  history?: Array<{ t: number, p: number }>
}

function resolveFidelityForSpan(spanSeconds: number): number {
  if (spanSeconds <= 2 * 24 * 3600) return 5
  if (spanSeconds <= 7 * 24 * 3600) return 30
  if (spanSeconds <= 30 * 24 * 3600) return 180
  return 720
}

export async function fetchEmbedPriceHistory(
  tokenId: string,
  createdAtIso: string,
  resolvedAtIso?: string | null,
): Promise<EmbedPricePoint[]> {
  const clobUrl = process.env.CLOB_URL
  if (!clobUrl || !tokenId) {
    return []
  }

  try {
    const created = new Date(createdAtIso)
    const createdSeconds = Number.isFinite(created.getTime())
      ? Math.floor(created.getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 30 * 24 * 3600

    const resolvedMs = resolvedAtIso ? new Date(resolvedAtIso).getTime() : Number.NaN
    const resolvedSeconds = Number.isFinite(resolvedMs)
      ? Math.floor(resolvedMs / 1000)
      : Number.NaN
    const realNowSeconds = Math.floor(Date.now() / 1000)
    const endSeconds = Number.isFinite(resolvedSeconds)
      ? Math.min(realNowSeconds, resolvedSeconds)
      : realNowSeconds
    const nowSeconds = Math.max(createdSeconds + 60, endSeconds)
    const ageSeconds = Math.max(0, nowSeconds - createdSeconds)
    const fidelity = resolveFidelityForSpan(ageSeconds)

    const url = new URL(`${clobUrl}/prices-history`)
    url.searchParams.set('market', tokenId)
    url.searchParams.set('fidelity', fidelity.toString())
    url.searchParams.set('startTs', createdSeconds.toString())
    url.searchParams.set('endTs', nowSeconds.toString())

    const response = await fetch(url.toString(), { next: { revalidate: 60 } })
    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as PriceHistoryResponse
    return (payload.history ?? [])
      .map(point => ({ t: Number(point.t), p: Number(point.p) }))
      .filter(point => Number.isFinite(point.t) && Number.isFinite(point.p))
  }
  catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// SVG path generation
// ---------------------------------------------------------------------------

function computeAxisTicks(minPercent: number, maxPercent: number): number[] {
  const range = maxPercent - minPercent
  if (range <= 0) {
    return [0, 50, 100]
  }

  const step = Math.max(1, Math.round(range / (CHART_AXIS_TICK_COUNT - 1)))
  const ticks: number[] = []
  for (let i = 0; i < CHART_AXIS_TICK_COUNT; i++) {
    const value = Math.round(minPercent + i * step)
    ticks.push(Math.min(100, Math.max(0, value)))
  }
  return ticks
}

export function buildEmbedChart(
  seriesList: EmbedChartSeries[],
  viewBoxWidth: number,
  viewBoxHeight: number,
): EmbedChartData {
  const plotLeft = CHART_PADDING.left
  const plotRight = viewBoxWidth - CHART_PADDING.right
  const plotTop = CHART_PADDING.top
  const plotBottom = viewBoxHeight - CHART_PADDING.bottom
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  if (plotWidth <= 0 || plotHeight <= 0) {
    return { lines: [], axisTicks: [], viewBoxWidth, viewBoxHeight }
  }

  // Determine price range across all series for autoscaling
  let globalMin = 1
  let globalMax = 0
  for (const series of seriesList) {
    for (const point of series.points) {
      const clamped = clampPrice(point.p)
      if (clamped < globalMin) globalMin = clamped
      if (clamped > globalMax) globalMax = clamped
    }
  }

  // Add padding to the range
  const rangePadding = Math.max(0.05, (globalMax - globalMin) * 0.1)
  const scaleMin = Math.max(0, globalMin - rangePadding)
  const scaleMax = Math.min(1, globalMax + rangePadding)
  const priceRange = scaleMax - scaleMin || 1

  const minPercent = Math.round(scaleMin * 100)
  const maxPercent = Math.round(scaleMax * 100)
  const tickValues = computeAxisTicks(minPercent, maxPercent)

  const axisTicks: EmbedAxisTick[] = tickValues.map((percentValue) => {
    const normalized = (percentValue / 100 - scaleMin) / priceRange
    const y = plotBottom - normalized * plotHeight
    return { y, label: `${percentValue}%` }
  })

  const lines: EmbedChartLine[] = seriesList.map((series) => {
    const { points } = series
    if (points.length === 0) {
      return {
        key: series.key,
        color: series.color,
        pathD: '',
        lastX: plotLeft,
        lastY: plotBottom,
        lastPercent: 0,
      }
    }

    const timestamps = points.map(p => p.t)
    const minT = Math.min(...timestamps)
    const maxT = Math.max(...timestamps)
    const timeRange = maxT - minT || 1

    const pathParts: string[] = []
    let lastX: number = plotLeft
    let lastY: number = plotBottom
    let lastPercent = 0

    points.forEach((point, index) => {
      const x = plotLeft + ((point.t - minT) / timeRange) * plotWidth
      const clamped = clampPrice(point.p)
      const normalized = (clamped - scaleMin) / priceRange
      const y = plotBottom - normalized * plotHeight

      const command = index === 0 ? 'M' : ' L'
      pathParts.push(`${command}${x.toFixed(1)},${y.toFixed(1)}`)

      lastX = x
      lastY = y
      lastPercent = Math.round(clamped * 100)
    })

    return {
      key: series.key,
      color: series.color,
      pathD: pathParts.join(''),
      lastX,
      lastY,
      lastPercent,
    }
  })

  return { lines, axisTicks, viewBoxWidth, viewBoxHeight }
}
