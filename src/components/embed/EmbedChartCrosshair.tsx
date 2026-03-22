'use client'

import type { EmbedChartData } from '@/lib/embed-chart'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  CHART_PADDING,
  PRICE_LABEL_FONT_SIZE,
  PRICE_LABEL_STROKE_WIDTH,
} from '@/lib/embed-dimensions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbedChartCrosshairProps {
  chart: EmbedChartData
  strokeBg: string
  svgChart: ReactNode
  staticLabel?: ReactNode
}

interface ParsedPoint {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Path parsing (done once, memoized)
// ---------------------------------------------------------------------------

/**
 * Parses an SVG path `d` attribute containing M and L commands into
 * an array of {x, y} points.  Handles both `M4.0,321.3` and `M 4.0,321.3`
 * and ` L20.0,321.3` formats.
 */
function parseSvgPath(pathD: string): ParsedPoint[] {
  if (!pathD) return []

  const points: ParsedPoint[] = []
  const regex = /[ML]\s*([\d.]+)\s*,\s*([\d.]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(pathD)) !== null) {
    const x = Number(match[1])
    const y = Number(match[2])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
    }
  }
  return points
}

/**
 * Given a sorted array of points and an X coordinate, interpolate the Y
 * value using binary search + linear interpolation.
 */
function interpolateY(points: ParsedPoint[], targetX: number): number {
  if (points.length === 0) return 0
  if (targetX <= points[0].x) return points[0].y
  if (targetX >= points[points.length - 1].x) return points[points.length - 1].y

  let lo = 0
  let hi = points.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].x <= targetX) lo = mid
    else hi = mid
  }

  const p0 = points[lo]
  const p1 = points[hi]
  const t = p1.x === p0.x ? 0 : (targetX - p0.x) / (p1.x - p0.x)
  return p0.y + t * (p1.y - p0.y)
}

function yToPercent(y: number, viewBoxHeight: number): number {
  const plotTop = CHART_PADDING.top
  const plotBottom = viewBoxHeight - CHART_PADDING.bottom
  const plotHeight = plotBottom - plotTop
  if (plotHeight <= 0) return 0

  const normalized = (plotBottom - y) / plotHeight
  return Math.round(Math.min(100, Math.max(0, normalized * 100)))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Adds interactive crosshair tracking to the embed chart.
 *
 * On mouse hover the static price label fades out and a dynamic label
 * follows the cursor, showing the interpolated percentage at that
 * position on the chart line.
 */
export default function EmbedChartCrosshair({
  chart,
  strokeBg,
  svgChart,
  staticLabel,
}: EmbedChartCrosshairProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cursorX, setCursorX] = useState<number | null>(null)
  const [cursorPercent, setCursorPercent] = useState(0)

  const primaryLine = chart.lines[0] ?? null

  // Parse the path once and memoize
  const parsedPoints = useMemo(
    () => primaryLine ? parseSvgPath(primaryLine.pathD) : [],
    [primaryLine],
  )

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || parsedPoints.length === 0) return

    const rect = container.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const widthRatio = relativeX / rect.width

    // Map CSS position to SVG viewBox X coordinate
    const plotWidth = chart.viewBoxWidth - CHART_PADDING.left - CHART_PADDING.right
    const svgX = CHART_PADDING.left + widthRatio * plotWidth

    const interpolatedY = interpolateY(parsedPoints, svgX)
    const percent = yToPercent(interpolatedY, chart.viewBoxHeight)

    setCursorX(relativeX)
    setCursorPercent(percent)
  }, [chart.viewBoxWidth, chart.viewBoxHeight, parsedPoints])

  const handleMouseLeave = useCallback(() => {
    setCursorX(null)
  }, [])

  const isHovering = cursorX !== null

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {svgChart}

      {/* Static price label — fades out on hover */}
      {staticLabel && !isHovering && staticLabel}

      {/* Dynamic crosshair label — follows mouse */}
      {isHovering && primaryLine && (
        <div
          className="absolute top-1 pointer-events-none z-10"
          style={{ left: `${cursorX}px`, transform: 'translateX(-50%)' }}
        >
          <span
            className="font-semibold leading-none whitespace-nowrap"
            style={{
              WebkitTextStroke: `${PRICE_LABEL_STROKE_WIDTH} ${strokeBg}`,
              fontSize: PRICE_LABEL_FONT_SIZE,
              color: primaryLine.color,
              paintOrder: 'stroke',
            }}
          >
            {cursorPercent}%
          </span>
        </div>
      )}
    </div>
  )
}
