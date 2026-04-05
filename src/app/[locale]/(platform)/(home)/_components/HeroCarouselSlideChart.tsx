'use client'

import type { Event } from '@/types'
import type { PredictionChartCursorSnapshot } from '@/types/PredictionChartTypes'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState } from 'react'
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

interface HeroCarouselSlideChartProps {
  event: Event
  isActive: boolean
  onCursorDataChange?: (snapshot: PredictionChartCursorSnapshot | null) => void
}

const HERO_CHART_RANGE = '1W' as const
const MAX_HERO_SERIES = 4
const MIN_CHART_WIDTH = 200
const MIN_CHART_HEIGHT = 150

export default function HeroCarouselSlideChart({
  event,
  isActive,
  onCursorDataChange,
}: HeroCarouselSlideChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null)

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
              showLegend={false}
              lineStrokeWidth={2}
              lineCurve="catmullRom"
              margin={{ top: 10, right: 12, bottom: 24, left: 0 }}
              xAxisTickCount={3}
              yAxis={{ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }}
              autoscale={false}
              cursorStepMs={CURSOR_STEP_MS[HERO_CHART_RANGE]}
              onCursorDataChange={onCursorDataChange}
            />
          )
        : <Skeleton className="size-full rounded-lg" />}
    </div>
  )
}
