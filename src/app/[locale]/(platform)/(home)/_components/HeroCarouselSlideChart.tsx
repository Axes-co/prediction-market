'use client'

import type { MarketTokenTarget } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import type { PredictionChartCursorSnapshot, SeriesConfig } from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useResizeObserver } from '@/app/[locale]/(platform)/(home)/_hooks/useResizeObserver'
import {
  CURSOR_STEP_MS,

  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import {
  buildChartSeries,
  getTopMarketIds,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { Skeleton } from '@/components/ui/skeleton'
import { OUTCOME_INDEX } from '@/lib/constants'
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
  variant: HeroChartVariant
  sportsModel?: HomeSportsMoneylineModel | null
}

// Polymarket carousel chart ranges (from their JS bundle CAROUSEL_CHART_OPTIONS):
//   Sports cards: forcedWindow="1d"
//   All other cards: forcedWindow="all"
const SPORTS_CHART_RANGE = '1D' as const
const DEFAULT_CHART_RANGE = 'ALL' as const
const MAX_HERO_SERIES = 4
const MIN_CHART_WIDTH = 200
const MIN_CHART_HEIGHT = 150
// Right margin accommodates the Y-axis labels (rendered on right via AxisRight).
// Polymarket uses yAxisOrientation:"right" with dynamic right margin.
const CHART_MARGIN = { top: 10, right: 40, bottom: 24, left: 0 }
const PLOT_CLIP_RIGHT_PADDING = 18
const LABEL_SPACE_RATIO = 0.65

// ---------------------------------------------------------------------------
// Sports series + targets
//
// Mirrors SportsGameGraph (SportsGamesCenter.tsx lines 1412-1428):
//   marketTargets maps each graphSeriesTarget to { conditionId: target.key, tokenId: target.tokenId }
//   This means useEventPriceHistory keys data by the SERIES KEY, not the raw conditionId.
//   For binary moneyline: key = "conditionId:outcomeIndex" with per-outcome tokenId.
//   For separated moneyline: key = conditionId with YES outcome tokenId.
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

interface SportsChartConfig {
  series: SeriesConfig[]
  targets: MarketTokenTarget[]
}

/**
 * Builds chart series AND data-fetch targets for sports events.
 *
 * Uses the same key strategy as SportsGameGraph.graphSeriesTargets:
 *   - Separated moneyline (neg-risk): key = conditionId, tokenId = YES outcome
 *   - Binary moneyline: key = conditionId:outcomeIndex, tokenId = per-outcome token
 *
 * And the same target mapping as SportsGameGraph (line 1416):
 *   { conditionId: target.key, tokenId: target.tokenId }
 * so useEventPriceHistory keys results by the series key directly.
 */
function buildSportsChartConfig(
  event: Event,
  model: HomeSportsMoneylineModel,
): SportsChartConfig {
  const buttons = [
    model.team1Button,
    model.drawButton,
    model.team2Button,
  ].filter((b): b is HomeSportsMoneylineButton => Boolean(b))

  const uniqueConditionIds = new Set(buttons.map(b => b.conditionId))
  const isBinaryMoneyline = uniqueConditionIds.size === 1

  const series: SeriesConfig[] = []
  const targets: MarketTokenTarget[] = []

  for (const [index, button] of buttons.entries()) {
    const market = event.markets.find(m => m.condition_id === button.conditionId)
    if (!market) {
      continue
    }

    const outcome = market.outcomes.find(o => o.outcome_index === button.outcomeIndex)
      ?? (isBinaryMoneyline ? null : market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES))
      ?? market.outcomes[0]

    if (!outcome?.token_id) {
      continue
    }

    const key = isBinaryMoneyline
      ? `${button.conditionId}:${button.outcomeIndex}`
      : button.conditionId

    series.push({
      key,
      name: button.label,
      color: resolveButtonColor(model, button, index),
    })

    targets.push({
      conditionId: key,
      tokenId: outcome.token_id,
    })
  }

  return { series, targets }
}

// ---------------------------------------------------------------------------
// Standard series + targets
// ---------------------------------------------------------------------------

interface StandardChartConfig {
  series: SeriesConfig[]
  targets: MarketTokenTarget[]
}

function buildStandardChartConfig(event: Event, chances: Record<string, number>): StandardChartConfig {
  const marketIds = getTopMarketIds(chances, MAX_HERO_SERIES)
  let series = buildChartSeries(event, marketIds)

  // Single-market: var(--primary) to match EventChart.effectiveSeries.
  if (series.length === 1) {
    series = [{ ...series[0], color: 'var(--primary)' }]
  }

  // Build targets using conditionId as key (standard flow).
  const targets: MarketTokenTarget[] = event.markets
    .map((market) => {
      const outcome = market.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES)
        ?? market.outcomes[0]
      if (!outcome?.token_id) {
        return null
      }
      return { conditionId: market.condition_id, tokenId: outcome.token_id }
    })
    .filter((t): t is MarketTokenTarget => t !== null)

  return { series, targets }
}

// ---------------------------------------------------------------------------
// Chart legend (multi-outcome only)
// ---------------------------------------------------------------------------

function HeroChartLegend({
  series,
  latestSnapshot,
  cursorSnapshot,
}: {
  series: SeriesConfig[]
  latestSnapshot: Record<string, number>
  cursorSnapshot: PredictionChartCursorSnapshot | null
}) {
  // Matches SportsGameGraph.legendSeriesWithValues (line 1776):
  // Use hovered value from cursor, fall back to latestSnapshot from chart data.
  const entries = useMemo(
    () => series.map((entry) => {
      const hoveredValue = cursorSnapshot?.values?.[entry.key]
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : (latestSnapshot[entry.key] ?? 0)
      return { ...entry, value }
    }),
    [series, cursorSnapshot, latestSnapshot],
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

  const chances = useMemo(
    () => buildChanceByMarket(event.markets),
    [event.markets],
  )

  // Resolve series and targets together — they must use matching keys.
  const chartConfig = useMemo(
    () => variant === 'sports' && sportsModel
      ? buildSportsChartConfig(event, sportsModel)
      : buildStandardChartConfig(event, chances),
    [event, variant, sportsModel, chances],
  )

  const chartRange = variant === 'sports' ? SPORTS_CHART_RANGE : DEFAULT_CHART_RANGE

  const { normalizedHistory } = useEventPriceHistory({
    eventId: event.id,
    range: chartRange,
    targets: chartConfig.targets,
    eventCreatedAt: event.created_at,
    eventResolvedAt: event.resolved_at,
  })

  // Filter data to only include columns matching our series keys.
  // Matches kuest's SportsGameGraph.historyChartData (line 1472) and
  // EventChart.chartData which uses filterChartDataForSeries.
  // Without this, extra market columns affect autoscale y-axis range.
  const chartData = useMemo(() => {
    const seriesKeys = chartConfig.series.map(s => s.key)
    return normalizedHistory
      .map((point) => {
        const filtered: Record<string, number | Date> & { date: Date } = { date: point.date }
        let hasValue = false
        for (const key of seriesKeys) {
          const value = point[key]
          if (typeof value === 'number' && Number.isFinite(value)) {
            filtered[key] = value
            hasValue = true
          }
        }
        return hasValue ? filtered : null
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
  }, [normalizedHistory, chartConfig.series])

  // Compute latest values from chart data for legend baseline.
  // Matches SportsGameGraph.latestSnapshot (line 1553-1572):
  // scans chartData backwards per series to find the last known value.
  const latestSnapshot = useMemo(() => {
    const values: Record<string, number> = {}
    for (const seriesItem of chartConfig.series) {
      for (let i = chartData.length - 1; i >= 0; i--) {
        const value = chartData[i][seriesItem.key]
        if (typeof value === 'number' && Number.isFinite(value)) {
          values[seriesItem.key] = value
          break
        }
      }
    }
    return values
  }, [chartData, chartConfig.series])

  const showLegend = chartConfig.series.length > 1
  const showEndOfLineLabels = variant === 'sports'
  const leadingGapStart = chartData[0]?.date ?? null

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
            series={chartConfig.series}
            latestSnapshot={latestSnapshot}
            cursorSnapshot={cursorSnapshot}
          />
        )
      : null,
    [showLegend, chartConfig.series, latestSnapshot, cursorSnapshot],
  )

  // Render chart whenever data is ready, even on preloaded (off-screen) slides.
  // This eliminates the skeleton flash during slide transitions — the chart SVG
  // is already rendered before the slide animates into view.
  const showChart = chartData.length > 0 && dimensions !== null

  // [HERO_CHART_DEBUG] Temporary instrumentation — remove once charts confirmed.
  if (typeof window !== 'undefined') {
    console.debug('[HeroChart]', event.slug, {
      variant,
      targets: chartConfig.targets.length,
      seriesKeys: chartConfig.series.map(s => s.key),
      historyPoints: normalizedHistory.length,
      filteredChartData: chartData.length,
      dimensions,
      showChart,
    })
  }

  return (
    <div ref={containerRef} className="size-full">
      {showChart
        ? (
            <PredictionChart
              data={chartData}
              series={chartConfig.series}
              width={dimensions.width}
              height={dimensions.height}
              showXAxis
              showYAxis
              showHorizontalGrid
              showVerticalGrid={false}
              legendContent={legendContent}
              showLegend={showLegend}
              lineCurve="monotoneX"
              lineStrokeWidth={1.75}
              margin={CHART_MARGIN}
              xDomain={xDomain}
              xAxisTickCount={3}
              autoscale
              cursorStepMs={CURSOR_STEP_MS[chartRange]}
              onCursorDataChange={setCursorSnapshot}
              showEndOfLineLabels={showEndOfLineLabels}
              leadingGapStart={leadingGapStart}
              plotClipPadding={{ right: PLOT_CLIP_RIGHT_PADDING }}
            />
          )
        : <Skeleton className="size-full rounded-lg" />}
    </div>
  )
}
