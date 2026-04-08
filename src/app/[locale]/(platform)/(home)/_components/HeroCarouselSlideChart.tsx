'use client'

import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import type { PredictionChartCursorSnapshot, SeriesConfig } from '@/types/PredictionChartTypes'
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
// Series resolution
//
// The hero chart resolves series differently per variant:
//
//   Sports  → builds series directly from the moneyline model buttons,
//             using team abbreviations as labels and team colors.
//             Mirrors SportsGameGraph (SportsGamesCenter.tsx):
//             - Separated moneyline: one conditionId per team (key = conditionId)
//             - Binary moneyline: shared conditionId (key = conditionId:outcomeIndex)
//
//   Standard → uses buildChartSeries (EventChartUtils) for multi-market,
//              then overrides single-market to var(--primary) to match
//              EventChart.effectiveSeries.
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

function buildSportsSeries(
  model: HomeSportsMoneylineModel,
): SeriesConfig[] {
  const buttons = [
    model.team1Button,
    model.drawButton,
    model.team2Button,
  ].filter((b): b is HomeSportsMoneylineButton => Boolean(b))

  // Detect binary moneyline: all buttons share one conditionId.
  // In this case, use compound key (conditionId:outcomeIndex) to match
  // SportsGameGraph.buildCompositeMoneylineGraphTargets.
  const uniqueConditionIds = new Set(buttons.map(b => b.conditionId))
  const isBinaryMoneyline = uniqueConditionIds.size === 1

  return buttons.map((button, index) => ({
    key: isBinaryMoneyline
      ? `${button.conditionId}:${button.outcomeIndex}`
      : button.conditionId,
    name: button.label,
    color: resolveButtonColor(model, button, index),
  }))
}

function resolveHeroSeries(
  event: Event,
  variant: HeroChartVariant,
  sportsModel: HomeSportsMoneylineModel | null | undefined,
  chances: Record<string, number>,
): SeriesConfig[] {
  if (variant === 'sports' && sportsModel) {
    return buildSportsSeries(sportsModel)
  }

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

  // --- Series ---

  const series = useMemo(
    () => resolveHeroSeries(event, variant, sportsModel, chances),
    [event, variant, sportsModel, chances],
  )

  const showLegend = variant === 'multi-outcome' && series.length > 1
  const showEndOfLineLabels = variant === 'sports'

  const xDomain = useMemo(() => {
    if (!showEndOfLineLabels || normalizedHistory.length < 2 || !clientNow) {
      return undefined
    }

    const firstTs = normalizedHistory[0].date.getTime()
    const lastTs = normalizedHistory.at(-1)!.date.getTime()
    const dataSpan = lastTs - firstTs

    if (dataSpan <= 0) {
      return undefined
    }

    return { end: lastTs + dataSpan * LABEL_SPACE_RATIO }
  }, [showEndOfLineLabels, normalizedHistory, clientNow])

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

  const showChart = isActive && normalizedHistory.length > 0 && dimensions !== null

  return (
    <div ref={containerRef} className="size-full">
      {showChart
        ? (
            <PredictionChart
              data={normalizedHistory}
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
