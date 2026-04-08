'use client'

import type { Event } from '@/types'
import type { PredictionChartProps } from '@/types/PredictionChartTypes'
import { TriangleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  LIVE_WINDOW_MS,
  MAX_POINTS,
  SERIES_KEY,
  useLiveChartStream,
} from '@/app/[locale]/(platform)/(home)/_hooks/useLiveChartStream'
import { useResizeObserver } from '@/app/[locale]/(platform)/(home)/_hooks/useResizeObserver'
import {
  buildMarketTargets,
  CURSOR_STEP_MS,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { Skeleton } from '@/components/ui/skeleton'
import { formatUsd } from '@/lib/live-chart'
import { buildLiveAxis } from '@/lib/prediction-chart'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Lazy-loaded chart
// ---------------------------------------------------------------------------

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-lg" /> },
)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HERO_CHART_RANGE = '1W' as const
const CHART_MARGIN = { top: 10, right: 16, bottom: 24, left: 0 }
const MIN_CHART_WIDTH = 200
const MIN_CHART_HEIGHT = 100
const PLOT_CLIP_RIGHT_PADDING = 18

function LIVE_X_AXIS_TICK_FORMATTER(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountdownUnit({ value, label, urgent }: { value: number, label: string, urgent: boolean }) {
  return (
    <div className="min-w-11 text-right">
      <div className={cn(
        'text-[22px] leading-none font-semibold tabular-nums',
        urgent ? 'text-destructive' : 'text-muted-foreground',
      )}
      >
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-1 text-2xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeroLiveChartPanelProps {
  event: Event
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HeroLiveChartPanel({ event, isActive }: HeroLiveChartPanelProps) {
  const t = useExtracted()
  const {
    config,
    baselinePrice,
    currentPrice,
    liveData,
    nowMs,
    subscriptionSymbol,
    explicitEndTimestamp,
  } = useLiveChartStream(event, isActive)

  const liveColor = config?.line_color || '#F59E0B'
  const priceDisplayDigits = config?.show_price_decimals ? 2 : 0
  const headerPriceDisplayDigits = Math.max(2, priceDisplayDigits)

  // Stable formatter refs — avoid creating new closures on every chart tick
  const yAxisTickFormat = useCallback((v: number) => formatUsd(v, priceDisplayDigits), [priceDisplayDigits])
  const liveTooltipFormatter = useCallback((v: number) => formatUsd(v, priceDisplayDigits), [priceDisplayDigits])

  // --- Chart dimensions ---
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState<{ width: number, height: number } | null>(null)
  const handleChartResize = useCallback((entry: ResizeObserverEntry) => {
    const { width, height } = entry.contentRect
    if (width >= MIN_CHART_WIDTH && height >= MIN_CHART_HEIGHT) {
      setChartDimensions({ width: Math.floor(width), height: Math.floor(height) })
    }
  }, [])
  useResizeObserver(chartContainerRef, handleChartResize)

  // --- Historical fallback ---
  const chartTargets = useMemo(() => buildMarketTargets(event.markets), [event.markets])
  const { normalizedHistory } = useEventPriceHistory({
    eventId: event.id,
    range: HERO_CHART_RANGE,
    targets: chartTargets,
    eventCreatedAt: event.created_at,
    eventResolvedAt: event.resolved_at,
  })

  // --- Live data windowing ---
  const hasLiveData = liveData.length > 0

  const liveRenderData = useMemo(() => {
    if (!hasLiveData || !nowMs) {
      return liveData
    }
    const domainStart = nowMs - LIVE_WINDOW_MS
    let lastPointBeforeDomain: typeof liveData[number] | null = null
    const pointsInDomain: typeof liveData = []

    for (const point of liveData) {
      const ts = point.date.getTime()
      if (!Number.isFinite(ts)) {
        continue
      }
      if (ts < domainStart) {
        lastPointBeforeDomain = point
        continue
      }
      if (ts <= nowMs) {
        pointsInDomain.push(point)
      }
    }

    // Include the last point before the window so the line enters from the
    // left edge — matching EventLiveSeriesChart's render pipeline.
    let next = pointsInDomain
    if (lastPointBeforeDomain) {
      next = pointsInDomain.length > 0
        ? [lastPointBeforeDomain, ...pointsInDomain]
        : [lastPointBeforeDomain]
    }

    // Extend to current time with the latest known price
    const lastPoint = next.at(-1)
    const lastPrice = lastPoint?.[SERIES_KEY]
    const lastTs = lastPoint?.date.getTime() ?? 0
    if (typeof lastPrice === 'number' && Number.isFinite(lastPrice) && nowMs > lastTs) {
      next = [...next, { date: new Date(nowMs), [SERIES_KEY]: lastPrice }].slice(-MAX_POINTS)
    }
    return next
  }, [liveData, hasLiveData, nowMs])

  const liveXDomain = useMemo(() => {
    if (!nowMs) {
      return undefined
    }
    return { start: new Date(nowMs - LIVE_WINDOW_MS), end: new Date(nowMs) }
  }, [nowMs])

  // --- Resolved chart props ---
  const isLiveMode = hasLiveData
  const chartData = isLiveMode ? liveRenderData : normalizedHistory
  const chartXDomain = isLiveMode ? liveXDomain : undefined

  const chartSeries = useMemo(() => [{
    key: SERIES_KEY,
    name: config?.display_symbol || config?.display_name || event.title,
    color: config?.line_color || liveColor,
  }], [config?.display_symbol, config?.display_name, config?.line_color, event.title, liveColor])

  const chartYAxis = useMemo(() => {
    if (!isLiveMode) {
      return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }
    }
    const values = chartData
      .map(p => p[SERIES_KEY])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const axis = buildLiveAxis(values, priceDisplayDigits)
    return {
      min: axis.min,
      max: axis.max,
      ticks: axis.ticks,
      tickFormat: yAxisTickFormat,
    }
  }, [isLiveMode, chartData, priceDisplayDigits, yAxisTickFormat])

  const tooltipValueFormatter = isLiveMode ? liveTooltipFormatter : undefined

  // --- Countdown ---
  const endTimestamp = explicitEndTimestamp ?? nowMs
  const isEventClosed = explicitEndTimestamp != null && nowMs >= endTimestamp

  const countdown = useMemo(() => {
    if (!nowMs || explicitEndTimestamp == null) {
      return null
    }
    const totalSeconds = Math.max(0, Math.floor((explicitEndTimestamp - nowMs) / 1000))
    if (totalSeconds <= 0) {
      return null
    }
    const showDays = totalSeconds > 86400
    const days = showDays ? Math.floor(totalSeconds / 86400) : 0
    const hours = showDays ? Math.floor((totalSeconds % 86400) / 3600) : Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return { showDays, days, hours, minutes, seconds }
  }, [nowMs, explicitEndTimestamp])

  // --- Derived ---
  const delta = baselinePrice != null && currentPrice != null
    ? currentPrice - baselinePrice
    : null

  const showChart = isActive && chartData.length > 0 && chartDimensions !== null

  // --- Render ---
  return (
    <div className="flex size-full flex-col gap-3">
      {/* Header: Price To Beat | Current Price | Countdown */}
      {!config
        ? <Skeleton className="h-12 w-full rounded-lg" />
        : (
            <div className="flex items-center justify-between py-0.5 pr-2">
              {/* Left: prices */}
              <div className="flex items-center gap-4">
                {/* Price To Beat */}
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {t('Price To Beat')}
                  </span>
                  <span className="mt-1 text-[22px] leading-none font-semibold text-muted-foreground tabular-nums">
                    {baselinePrice != null ? formatUsd(baselinePrice, headerPriceDisplayDigits) : '--'}
                  </span>
                </div>

                <div className="hidden h-10 w-px bg-border sm:block" />

                {/* Current Price */}
                <div className="flex flex-col">
                  <div
                    className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase"
                    style={{ color: liveColor }}
                  >
                    <span>{t('Current Price')}</span>
                    {delta != null && (
                      <span className={cn(
                        'inline-flex items-center gap-0.5 text-[11px] font-semibold',
                        delta >= 0 ? 'text-yes' : 'text-no',
                      )}
                      >
                        <TriangleIcon
                          className={cn('size-2.5', delta < 0 && 'rotate-180')}
                          fill="currentColor"
                          stroke="none"
                        />
                        {formatUsd(Math.abs(delta), 0)}
                      </span>
                    )}
                  </div>
                  <span
                    className="mt-1 text-[22px] leading-none font-semibold tabular-nums"
                    style={{ color: liveColor }}
                  >
                    {currentPrice != null ? formatUsd(currentPrice, headerPriceDisplayDigits) : '--'}
                  </span>
                </div>
              </div>

              {/* Right: Countdown */}
              {countdown && !isEventClosed && (
                <div className="ml-auto flex flex-col items-end">
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {t('Ends in')}
                  </span>
                  <div className="mt-1 flex items-end gap-3">
                    {countdown.showDays && (
                      <CountdownUnit value={countdown.days} label={countdown.days === 1 ? t('Day') : t('Days')} urgent />
                    )}
                    <CountdownUnit
                      value={countdown.hours}
                      label={countdown.hours === 1 ? t('Hr') : t('Hrs')}
                      urgent={!countdown.showDays && countdown.hours === 0}
                    />
                    <CountdownUnit
                      value={countdown.minutes}
                      label={t('Min')}
                      urgent={countdown.hours === 0}
                    />
                    {!countdown.showDays && (
                      <CountdownUnit value={countdown.seconds} label={t('Sec')} urgent />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

      {/* Chart */}
      <div ref={chartContainerRef} className="min-h-[150px] flex-1">
        {showChart
          ? (
              <PredictionChart
                data={chartData}
                series={chartSeries}
                width={chartDimensions.width}
                height={chartDimensions.height}
                showXAxis
                showYAxis={false}
                showHorizontalGrid
                showVerticalGrid={false}
                showLegend={false}
                lineCurve={isLiveMode ? 'catmullRom' : 'monotoneX'}
                margin={CHART_MARGIN}
                xDomain={chartXDomain}
                xAxisTickCount={3}
                xAxisTickFormatter={isLiveMode ? LIVE_X_AXIS_TICK_FORMATTER : undefined}
                yAxis={chartYAxis}
                autoscale={!isLiveMode}
                cursorStepMs={isLiveMode ? undefined : CURSOR_STEP_MS[HERO_CHART_RANGE]}
                dataSignature={isLiveMode ? `${event.id}:live:${subscriptionSymbol}` : undefined}
                tooltipValueFormatter={tooltipValueFormatter}
                plotClipPadding={{ right: PLOT_CLIP_RIGHT_PADDING }}
                disableCursorSplit={isLiveMode}
                disableResetAnimation={isLiveMode}
                markerOuterRadius={isLiveMode ? 10 : undefined}
                markerInnerRadius={isLiveMode ? 4.2 : undefined}
                markerPulseStyle={isLiveMode ? 'ring' : undefined}
                lineStrokeWidth={isLiveMode ? 2.15 : undefined}
                showAreaFill={isLiveMode}
                areaFillTopOpacity={0.08}
                areaFillBottomOpacity={0}
                gridLineStyle={isLiveMode ? 'solid' : undefined}
                gridLineOpacity={isLiveMode ? 0.42 : undefined}
              />
            )
          : <Skeleton className="size-full rounded-lg" />}
      </div>
    </div>
  )
}
