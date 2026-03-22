'use client'

import type { EmbedChartData } from '@/lib/embed-chart'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  CHART_DOT_RADIUS,
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

interface CursorState {
  /** SVG X coordinate on the line */
  svgX: number
  /** SVG Y coordinate on the line (interpolated) */
  svgY: number
  /** Percentage value at this point */
  percent: number
  /** CSS X position relative to container */
  cssX: number
  /** CSS Y position relative to container */
  cssY: number
}

// ---------------------------------------------------------------------------
// Path parsing (memoized)
// ---------------------------------------------------------------------------

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
 * On hover:
 * - A colored dot snaps to the interpolated position on the chart line
 * - A pulsing ring animates around the dot (matching Polymarket)
 * - The percentage label follows the dot
 * - The static end-of-line label hides
 */
export default function EmbedChartCrosshair({
  chart,
  strokeBg,
  svgChart,
  staticLabel,
}: EmbedChartCrosshairProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)

  const primaryLine = chart.lines[0] ?? null

  const parsedPoints = useMemo(
    () => primaryLine ? parseSvgPath(primaryLine.pathD) : [],
    [primaryLine],
  )

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || parsedPoints.length === 0) return

    const rect = container.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const relativeY = e.clientY - rect.top
    const widthRatio = relativeX / rect.width
    const heightRatio = rect.height > 0 ? 1 / rect.height : 0

    // Map CSS position to SVG viewBox coordinates
    const plotWidth = chart.viewBoxWidth - CHART_PADDING.left - CHART_PADDING.right
    const svgX = CHART_PADDING.left + widthRatio * plotWidth

    const svgY = interpolateY(parsedPoints, svgX)
    const percent = yToPercent(svgY, chart.viewBoxHeight)

    // Convert SVG Y back to CSS Y for the label positioning
    const cssY = (svgY / chart.viewBoxHeight) * rect.height

    setCursor({ svgX, svgY, percent, cssX: relativeX, cssY })
  }, [chart.viewBoxWidth, chart.viewBoxHeight, parsedPoints])

  const handleMouseLeave = useCallback(() => {
    setCursor(null)
  }, [])

  const isHovering = cursor !== null

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 min-h-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG chart (server-rendered) */}
      {svgChart}

      {/* Overlay SVG for the tracking dot — positioned exactly over the chart */}
      {isHovering && primaryLine && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox={`0 0 ${chart.viewBoxWidth} ${chart.viewBoxHeight}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Solid dot on the line */}
          <circle
            cx={cursor.svgX}
            cy={cursor.svgY}
            r={CHART_DOT_RADIUS}
            fill={primaryLine.color}
            opacity={1}
          />
          {/* Pulsing ring around the dot */}
          <circle
            cx={cursor.svgX}
            cy={cursor.svgY}
            r={CHART_DOT_RADIUS}
            fill={primaryLine.color}
            opacity={0.3}
            style={{
              transformOrigin: '50% 50%',
              transformBox: 'fill-box' as const,
              transform: 'scale(2.5)',
            }}
          />
        </svg>
      )}

      {/* Static price label — hidden on hover */}
      {staticLabel && !isHovering && staticLabel}

      {/* Dynamic percentage label — follows the dot position */}
      {isHovering && primaryLine && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${cursor.cssX}px`,
            top: `${Math.max(4, cursor.cssY - 28)}px`,
            transform: 'translateX(-50%)',
          }}
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
            {cursor.percent}%
          </span>
        </div>
      )}
    </div>
  )
}
