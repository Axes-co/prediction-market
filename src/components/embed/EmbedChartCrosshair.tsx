'use client'

import type { ReactNode } from 'react'
import type { EmbedChartData } from '@/lib/embed-chart'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface LineCursorState {
  svgY: number
  percent: number
  color: string
}

interface CursorState {
  svgX: number
  cssX: number
  lines: LineCursorState[]
}

// ---------------------------------------------------------------------------
// Path parsing & interpolation
// ---------------------------------------------------------------------------

function parseSvgPath(pathD: string): ParsedPoint[] {
  if (!pathD) {
    return []
  }
  const points: ParsedPoint[] = []
  const regex = /[ML]\s*([\d.]+)\s*,\s*([\d.]+)/g
  let match: RegExpExecArray | null = regex.exec(pathD)
  while (match !== null) {
    const x = Number(match[1])
    const y = Number(match[2])
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
    }
    match = regex.exec(pathD)
  }
  return points
}

function interpolateY(points: ParsedPoint[], targetX: number): number {
  if (points.length === 0) {
    return 0
  }
  if (targetX <= points[0].x) {
    return points[0].y
  }
  if (targetX >= points.at(-1)!.x) {
    return points.at(-1)!.y
  }

  let lo = 0
  let hi = points.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].x <= targetX) {
      lo = mid
    }
    else {
      hi = mid
    }
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
  if (plotHeight <= 0) {
    return 0
  }
  const normalized = (plotBottom - y) / plotHeight
  return Math.round(Math.min(100, Math.max(0, normalized * 100)))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmbedChartCrosshair({
  chart,
  strokeBg,
  svgChart,
  staticLabel,
}: EmbedChartCrosshairProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<CursorState | null>(null)

  // Parse ALL chart lines once and memoize
  const parsedLines = useMemo(
    () => chart.lines.map(line => ({
      key: line.key,
      color: line.color,
      points: parseSvgPath(line.pathD),
    })),
    [chart.lines],
  )

  // Chart plot area boundaries in SVG coordinates
  const plotLeft = CHART_PADDING.left
  const plotRight = chart.viewBoxWidth - CHART_PADDING.right

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || parsedLines.length === 0) {
      return
    }

    const rect = container.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const svgX = (relativeX / rect.width) * chart.viewBoxWidth

    // Only show crosshair within the chart plot area
    if (svgX < plotLeft || svgX > plotRight) {
      setCursor(null)
      return
    }

    // Interpolate Y position on every line at this X coordinate
    const lines: LineCursorState[] = parsedLines
      .filter(line => line.points.length > 0)
      .map((line) => {
        const svgY = interpolateY(line.points, svgX)
        return {
          svgY,
          percent: yToPercent(svgY, chart.viewBoxHeight),
          color: line.color,
        }
      })

    setCursor({ svgX, cssX: relativeX, lines })
  }, [chart.viewBoxWidth, chart.viewBoxHeight, parsedLines, plotLeft, plotRight])

  const clearCursor = useCallback(() => setCursor(null), [])

  // Clear crosshair when mouse leaves the iframe boundary
  useEffect(() => {
    document.addEventListener('mouseleave', clearCursor)
    return () => document.removeEventListener('mouseleave', clearCursor)
  }, [clearCursor])

  const isHovering = cursor !== null
  const primaryLine = cursor?.lines[0] ?? null

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1"
      style={{ touchAction: 'pan-y pan-x' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={clearCursor}
    >
      {svgChart}

      {/* Overlay SVG — tracking dots on ALL chart lines */}
      {isHovering && cursor.lines.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${chart.viewBoxWidth} ${chart.viewBoxHeight}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {cursor.lines.map((line, i) => (
            <g key={i}>
              <circle cx={cursor.svgX} cy={line.svgY} r={CHART_DOT_RADIUS} fill={line.color} />
              <circle
                cx={cursor.svgX}
                cy={line.svgY}
                r={CHART_DOT_RADIUS}
                fill={line.color}
                opacity={0.3}
                style={{ transformOrigin: '50% 50%', transformBox: 'fill-box' as const, transform: 'scale(2.5)' }}
              />
            </g>
          ))}
        </svg>
      )}

      {/* Static price label — hidden on hover */}
      {staticLabel && !isHovering && staticLabel}

      {/* Dynamic percentage label — shows primary line value above its dot */}
      {isHovering && primaryLine && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${cursor.cssX}px`,
            top: `${Math.max(0, (primaryLine.svgY / chart.viewBoxHeight) * (containerRef.current?.getBoundingClientRect().height ?? 0) - 28)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <span
            className="leading-none font-semibold whitespace-nowrap"
            style={{
              WebkitTextStroke: `${PRICE_LABEL_STROKE_WIDTH} ${strokeBg}`,
              fontSize: PRICE_LABEL_FONT_SIZE,
              color: primaryLine.color,
              paintOrder: 'stroke',
            }}
          >
            {primaryLine.percent}
            %
          </span>
        </div>
      )}
    </div>
  )
}
