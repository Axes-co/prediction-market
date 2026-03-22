'use client'

import type { EmbedChartData } from '@/lib/embed-chart'
import type { ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'
import {
  CHART_PADDING,
  PRICE_LABEL_FONT_SIZE,
  PRICE_LABEL_STROKE_WIDTH,
} from '@/lib/embed-dimensions'

interface EmbedChartCrosshairProps {
  chart: EmbedChartData
  strokeBg: string
  /** The SVG chart element (always visible) */
  svgChart: ReactNode
  /** The static price label (hidden during hover) */
  staticLabel?: ReactNode
}

interface CursorState {
  /** CSS X position relative to container (px) */
  cssX: number
  /** Interpolated percentage at cursor position */
  percent: number
  /** Line color */
  color: string
}

/**
 * Client component that adds crosshair mouse tracking over the SVG chart.
 *
 * When the user hovers, a floating percentage label follows the cursor
 * along the chart line — matching Polymarket's embed behavior.
 * The static price label is hidden during hover and replaced by the
 * dynamic one that tracks the mouse.
 */
export default function EmbedChartCrosshair({
  chart,
  strokeBg,
  svgChart,
  staticLabel,
}: EmbedChartCrosshairProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || chart.lines.length === 0) return

    const rect = container.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const widthRatio = relativeX / rect.width

    const plotLeft = CHART_PADDING.left
    const plotWidth = chart.viewBoxWidth - CHART_PADDING.left - CHART_PADDING.right
    const svgX = plotLeft + widthRatio * plotWidth

    const primaryLine = chart.lines[0]
    const percent = interpolatePercent(primaryLine.pathD, svgX, chart.viewBoxHeight)

    setCursor({ cssX: relativeX, percent, color: primaryLine.color })
  }, [chart])

  const handleMouseLeave = useCallback(() => {
    setCursor(null)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG chart — always visible */}
      {svgChart}

      {/* Static price label — hidden when cursor is active */}
      {staticLabel && (
        <div className="transition-opacity duration-75" style={{ opacity: cursor ? 0 : 1 }}>
          {staticLabel}
        </div>
      )}

      {/* Dynamic crosshair price label — follows mouse */}
      {cursor && (
        <div
          className="absolute top-1 pointer-events-none z-10"
          style={{ left: `${cursor.cssX}px`, transform: 'translateX(-50%)' }}
        >
          <span
            className="font-semibold leading-none whitespace-nowrap"
            style={{
              WebkitTextStroke: `${PRICE_LABEL_STROKE_WIDTH} ${strokeBg}`,
              fontSize: PRICE_LABEL_FONT_SIZE,
              color: cursor.color,
              paintOrder: 'stroke',
            }}
          >
            {cursor.percent}%
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Path interpolation
// ---------------------------------------------------------------------------

function interpolatePercent(
  pathD: string,
  targetX: number,
  viewBoxHeight: number,
): number {
  if (!pathD) return 0

  const points: Array<{ x: number, y: number }> = []
  const regex = /[ML]\s*([\d.]+),([\d.]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(pathD)) !== null) {
    points.push({ x: Number(match[1]), y: Number(match[2]) })
  }

  if (points.length === 0) return 0

  if (targetX <= points[0].x) return yToPercent(points[0].y, viewBoxHeight)
  if (targetX >= points[points.length - 1].x) return yToPercent(points[points.length - 1].y, viewBoxHeight)

  let lo = 0
  let hi = points.length - 1
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (points[mid].x <= targetX) lo = mid
    else hi = mid
  }

  const p0 = points[lo]
  const p1 = points[hi]
  const t = p1.x === p0.x ? 0 : (targetX - p0.x) / (p1.x - p0.x)
  const interpolatedY = p0.y + t * (p1.y - p0.y)

  return yToPercent(interpolatedY, viewBoxHeight)
}

function yToPercent(y: number, viewBoxHeight: number): number {
  const plotTop = CHART_PADDING.top
  const plotBottom = viewBoxHeight - CHART_PADDING.bottom
  const plotHeight = plotBottom - plotTop
  if (plotHeight <= 0) return 0

  const normalized = (plotBottom - y) / plotHeight
  return Math.round(Math.min(100, Math.max(0, normalized * 100)))
}
