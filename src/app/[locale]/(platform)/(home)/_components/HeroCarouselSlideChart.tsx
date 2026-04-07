'use client'

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

const PredictionChart = dynamic(
  () => import('@/components/PredictionChart'),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full rounded-lg" />,
  },
)

type HeroChartVariant = 'multi-outcome' | 'sports'

interface HeroCarouselSlideChartProps {
  event: Event
  isActive: boolean
  variant: HeroChartVariant
}

const HERO_CHART_RANGE = '1W' as const
const MAX_HERO_SERIES = 4
const MIN_CHART_WIDTH = 200
const MIN_CHART_HEIGHT = 150
const CHART_MARGIN = { top: 10, right: 12, bottom: 24, left: 0 }

/**
 * Polymarket stops chart lines at ~60% of the width so end-of-line labels
 * have room on the right. We achieve this by extending xDomain.end past
 * the last data point by ~65% of the data's time span, so the last point
 * maps to ~60% of the chart width.
 */
const LABEL_SPACE_RATIO = 0.65

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

export default function HeroCarouselSlideChart({
  event,
  isActive,
  variant,
}: HeroCarouselSlideChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)

  // Client-side timestamp to avoid SSR hydration mismatch with Date.now()
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

  const topMarketIds = useMemo(
    () => getTopMarketIds(chances, MAX_HERO_SERIES),
    [chances],
  )

  const series = useMemo(
    () => buildChartSeries(event, topMarketIds),
    [event, topMarketIds],
  )

  const showLegend = variant === 'multi-outcome'
  const showEndOfLineLabels = variant === 'sports'

  // For sports cards with end-of-line labels: extend xDomain past the last data point
  // so the chart line ends at ~60% width, leaving 40% for labels (matches Polymarket).
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

    // Extend domain end by LABEL_SPACE_RATIO of the data span
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
              showHorizontalGrid={false}
              showVerticalGrid={false}
              showAreaFill
              areaFillTopOpacity={0.12}
              legendContent={legendContent}
              showLegend={showLegend}
              lineStrokeWidth={2}
              lineCurve="catmullRom"
              margin={CHART_MARGIN}
              xDomain={xDomain}
              xAxisTickCount={3}
              yAxis={{ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }}
              autoscale={false}
              cursorStepMs={CURSOR_STEP_MS[HERO_CHART_RANGE]}
              onCursorDataChange={setCursorSnapshot}
              showEndOfLineLabels={showEndOfLineLabels}
            />
          )
        : <Skeleton className="size-full rounded-lg" />}
    </div>
  )
}
