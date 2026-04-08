'use client'

import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import type { DataPoint, PredictionChartCursorSnapshot, SeriesConfig } from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useResizeObserver } from '@/app/[locale]/(platform)/(home)/_hooks/useResizeObserver'
import {
  buildMarketTargets,
  CURSOR_STEP_MS,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import {
  buildChartSeries,
  getTopMarketIds,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { Skeleton } from '@/components/ui/skeleton'
import { buildChanceByMarket } from '@/lib/market-chance'
import { resolveSportsTeamFallbackColor } from '@/lib/sports-team-colors'

const PredictionChart = dynamic(
  () => import('@/components/PredictionChart'),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full rounded-lg" />,
  },
)

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type HeroChartVariant = 'multi-outcome' | 'sports'

interface HeroCarouselSlideChartProps {
  event: Event
  isActive: boolean
  variant: HeroChartVariant
  sportsModel?: HomeSportsMoneylineModel | null
}

const HERO_CHART_RANGE = '1W' as const
const MAX_HERO_SERIES = 4
const MIN_CHART_WIDTH = 200
const MIN_CHART_HEIGHT = 150
const CHART_MARGIN = { top: 10, right: 16, bottom: 24, left: 0 }
const PLOT_CLIP_RIGHT_PADDING = 18

/**
 * Extend xDomain past last data point by this ratio of the data span,
 * so the chart line ends at ~60% width leaving room for end-of-line labels.
 */
const LABEL_SPACE_RATIO = 0.65

// ---------------------------------------------------------------------------
// Sports series resolution
//
// Mirrors SportsGameGraph (SportsGamesCenter.tsx) which handles two cases:
//
//   Separated moneyline (neg-risk): each team has its own conditionId/market.
//     → useEventPriceHistory returns independent data per conditionId.
//     → Series key = conditionId (matches data directly).
//
//   Binary moneyline (non-neg-risk): both teams share one conditionId/market.
//     → useEventPriceHistory returns one column for the YES outcome (team1).
//     → We derive team2 = 100 - team1, keyed with compound keys.
//     → Mirrors SportsGameGraph.buildCompositeMoneylineGraphTargets.
// ---------------------------------------------------------------------------

const SPORTS_FALLBACK_COLORS = ['var(--yes)', 'var(--primary)', 'var(--no)']

function resolveButtonColor(
  model: HomeSportsMoneylineModel,
  button: HomeSportsMoneylineButton,
  fallbackIndex: number,
): string {
  if (button.tone === 'team1') {
    return model.team1.color ?? resolveSportsTeamFallbackColor('team1')
  }
  if (button.tone === 'team2') {
    return model.team2.color ?? resolveSportsTeamFallbackColor('team2')
  }
  if (button.tone === 'draw') {
    return 'var(--secondary-foreground)'
  }
  return SPORTS_FALLBACK_COLORS[fallbackIndex % SPORTS_FALLBACK_COLORS.length]
}

interface SportsSeriesResult {
  series: SeriesConfig[]
  isBinaryMoneyline: boolean
  sharedConditionId: string | null
}

function buildSportsSeries(model: HomeSportsMoneylineModel): SportsSeriesResult {
  const buttons = [
    model.team1Button,
    model.drawButton,
    model.team2Button,
  ].filter((b): b is HomeSportsMoneylineButton => Boolean(b))

  const uniqueConditionIds = new Set(buttons.map(b => b.conditionId))
  const isBinaryMoneyline = uniqueConditionIds.size === 1
  const sharedConditionId = isBinaryMoneyline ? buttons[0].conditionId : null

  const series = buttons.map((button, index) => ({
    key: isBinaryMoneyline
      ? `${button.conditionId}:${button.outcomeIndex}`
      : button.conditionId,
    name: button.label,
    color: resolveButtonColor(model, button, index),
  }))

  return { series, isBinaryMoneyline, sharedConditionId }
}

/**
 * For binary moneyline, normalizedHistory has data keyed by plain conditionId.
 * PredictionChart expects data keyed by compound series keys (conditionId:outcomeIndex).
 *
 * This transforms each data point:
 *   { date, "condId": 65 }  →  { date, "condId:0": 65, "condId:1": 35 }
 *
 * Mirrors how SportsGameGraph fetches per-outcome data via separate tokenIds.
 */
function transformBinaryMoneylineData(
  data: DataPoint[],
  conditionId: string,
  buttons: HomeSportsMoneylineButton[],
): DataPoint[] {
  return data.map((point) => {
    const yesValue = point[conditionId]
    if (typeof yesValue !== 'number') {
      return point
    }

    const transformed: DataPoint = { date: point.date }
    for (const button of buttons) {
      const compoundKey = `${conditionId}:${button.outcomeIndex}`
      // outcomeIndex 0 = YES (original value), outcomeIndex 1 = NO (complement)
      transformed[compoundKey] = button.outcomeIndex === 0 ? yesValue : 100 - yesValue
    }
    return transformed
  })
}

// ---------------------------------------------------------------------------
// Standard series resolution
// ---------------------------------------------------------------------------

function resolveStandardSeries(
  event: Event,
  chances: Record<string, number>,
): SeriesConfig[] {
  const marketIds = getTopMarketIds(chances, MAX_HERO_SERIES)
  const series = buildChartSeries(event, marketIds)

  // Single-market: var(--primary) to match EventChart.effectiveSeries.
  if (series.length === 1) {
    return [{ ...series[0], color: 'var(--primary)' }]
  }

  return series
}

// ---------------------------------------------------------------------------
// Chart legend (multi-outcome only)
// ---------------------------------------------------------------------------

function HeroChartLegend({
  series,
  chances,
  cursorSnapshot,
}: {
  series: SeriesConfig[]
  chances: Record<string, number>
  cursorSnapshot: PredictionChartCursorSnapshot | null
}) {
  const entries = useMemo(
    () => series.map((entry) => {
      const hoveredValue = cursorSnapshot?.values?.[entry.key]
      const baselineValue = chances[entry.key] ?? 0
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : baselineValue
      return { ...entry, value }
    }),
    [series, cursorSnapshot, chances],
  )

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {entries.map(entry => (
        <div key={entry.key} className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <p className="text-sm text-muted-foreground">
            {entry.name}
            <span className="ml-0.5 font-semibold text-foreground">
              &nbsp;
              {Number.isInteger(entry.value) ? `${entry.value}%` : `${entry.value.toFixed(1)}%`}
            </span>
          </p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main chart component
// ---------------------------------------------------------------------------

export default function HeroCarouselSlideChart({
  event,
  isActive,
  variant,
  sportsModel,
}: HeroCarouselSlideChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)

  const [clientNow, setClientNow] = useState<number | null>(null)
  useEffect(() => {
    setClientNow(Date.now())
  }, [])

  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    const { width, height } = entry.contentRect
    if (width >= MIN_CHART_WIDTH && height >= MIN_CHART_HEIGHT) {
      setDimensions({ width: Math.floor(width), height: Math.floor(height) })
    }
  }, [])

  useResizeObserver(containerRef, handleResize)

  // --- Data ---

  const targets = useMemo(
    () => buildMarketTargets(event.markets),
    [event.markets],
  )

  const { normalizedHistory } = useEventPriceHistory({
    eventId: event.id,
    range: HERO_CHART_RANGE,
    targets,
    eventCreatedAt: event.created_at,
    eventResolvedAt: event.resolved_at,
  })

  const chances = useMemo(
    () => buildChanceByMarket(event.markets),
    [event.markets],
  )

  // --- Series & data resolution ---

  const sportsResult = useMemo(
    () => variant === 'sports' && sportsModel ? buildSportsSeries(sportsModel) : null,
    [variant, sportsModel],
  )

  const series = useMemo(
    () => sportsResult?.series ?? resolveStandardSeries(event, chances),
    [sportsResult, event, chances],
  )

  // For binary moneyline, transform data to match compound series keys.
  // Separated moneyline and standard charts use normalizedHistory as-is.
  const chartData = useMemo(() => {
    if (!sportsResult?.isBinaryMoneyline || !sportsResult.sharedConditionId || !sportsModel) {
      return normalizedHistory
    }
    const buttons = [
      sportsModel.team1Button,
      sportsModel.drawButton,
      sportsModel.team2Button,
    ].filter((b): b is HomeSportsMoneylineButton => Boolean(b))

    return transformBinaryMoneylineData(normalizedHistory, sportsResult.sharedConditionId, buttons)
  }, [normalizedHistory, sportsResult, sportsModel])

  const showLegend = variant === 'multi-outcome' && series.length > 1
  const showEndOfLineLabels = variant === 'sports'

  const xDomain = useMemo(() => {
    if (!showEndOfLineLabels || chartData.length < 2 || !clientNow) {
      return undefined
    }

    const firstTs = chartData[0].date.getTime()
    const lastTs = chartData.at(-1)!.date.getTime()
    const dataSpan = lastTs - firstTs

    if (dataSpan <= 0) {
      return undefined
    }

    return { end: lastTs + dataSpan * LABEL_SPACE_RATIO }
  }, [showEndOfLineLabels, chartData, clientNow])

  const legendContent = useMemo(
    () => showLegend
      ? (
          <HeroChartLegend
            series={series}
            chances={chances}
            cursorSnapshot={cursorSnapshot}
          />
        )
      : null,
    [showLegend, series, chances, cursorSnapshot],
  )

  // --- Render ---

  const showChart = isActive && chartData.length > 0 && dimensions !== null

  return (
    <div ref={containerRef} className="size-full">
      {showChart
        ? (
            <PredictionChart
              data={chartData}
              series={series}
              width={dimensions.width}
              height={dimensions.height}
              showXAxis
              showYAxis={false}
              showHorizontalGrid
              showVerticalGrid={false}
              legendContent={legendContent}
              showLegend={showLegend}
              lineCurve="monotoneX"
              margin={CHART_MARGIN}
              xDomain={xDomain}
              xAxisTickCount={3}
              autoscale
              cursorStepMs={CURSOR_STEP_MS[HERO_CHART_RANGE]}
              onCursorDataChange={setCursorSnapshot}
              showEndOfLineLabels={showEndOfLineLabels}
              plotClipPadding={{ right: PLOT_CLIP_RIGHT_PADDING }}
            />
          )
        : <Skeleton className="size-full rounded-lg" />}
    </div>
  )
}
