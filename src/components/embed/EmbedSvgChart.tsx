import type { EmbedChartData } from '@/lib/embed-chart'
import type { EmbedTheme } from '@/lib/embed-theme'
import {
  CHART_AXIS_FONT_SIZE,
  CHART_DOT_RADIUS,
  CHART_GRID_STROKE_WIDTH,
  CHART_LINE_STROKE_WIDTH,
  CHART_PADDING,
} from '@/lib/embed-dimensions'
import { resolveEmbedPalette } from '@/lib/embed-theme'

interface EmbedSvgChartProps {
  chart: EmbedChartData
  showYAxis?: boolean
  showGridRows?: boolean
  theme: EmbedTheme
}

export default function EmbedSvgChart({
  chart,
  showYAxis = true,
  showGridRows = true,
  theme,
}: EmbedSvgChartProps) {
  const { lines, axisTicks, viewBoxWidth, viewBoxHeight } = chart
  const palette = resolveEmbedPalette(theme)
  const axisLabelX = viewBoxWidth - CHART_PADDING.right - 2
  const isSingleLine = lines.filter(l => l.pathD).length <= 1

  if (lines.length === 0) {
    return null
  }

  return (
    <svg
      className="w-full cursor-crosshair"
      preserveAspectRatio="none"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {showGridRows && axisTicks.map((tick, i) => (
        <line
          key={`grid-${i}`}
          stroke={palette.border}
          strokeDasharray="6 4"
          strokeWidth={CHART_GRID_STROKE_WIDTH}
          x1={CHART_PADDING.left}
          x2={viewBoxWidth - CHART_PADDING.right}
          y1={tick.y}
          y2={tick.y}
        />
      ))}

      {showYAxis && axisTicks.map((tick, i) => (
        isSingleLine
          ? (
              <g key={`label-${i}`}>
                <rect
                  fill={palette.bg}
                  height={CHART_AXIS_FONT_SIZE + 4}
                  width={CHART_PADDING.right - 2}
                  x={axisLabelX - 4}
                  y={tick.y - (CHART_AXIS_FONT_SIZE / 2) - 2}
                />
                <text
                  fill={palette.axisText}
                  fontFamily="sans-serif"
                  fontSize={CHART_AXIS_FONT_SIZE}
                  x={axisLabelX}
                  y={tick.y + 5}
                >
                  {tick.label}
                </text>
              </g>
            )
          : (
              <text
                key={`label-${i}`}
                fill={palette.axisText}
                fontFamily="sans-serif"
                fontSize={CHART_AXIS_FONT_SIZE}
                x={axisLabelX}
                y={tick.y + 5}
              >
                {tick.label}
              </text>
            )
      ))}

      {/* Render all paths first, then all dots — matches Polymarket z-order */}
      {lines.map(line => (
        line.pathD
          ? (
              <path
                key={line.key}
                className="pointer-events-none"
                d={line.pathD}
                fill="transparent"
                pathLength={1}
                stroke={line.color}
                strokeDasharray="1 1"
                strokeDashoffset="0"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={CHART_LINE_STROKE_WIDTH}
              />
            )
          : null
      ))}
      {lines.map(line => (
        line.pathD
          ? (
              <g key={`dot-${line.key}`} className="pointer-events-none">
                <circle
                  cx={line.lastX}
                  cy={line.lastY}
                  fill={line.color}
                  r={CHART_DOT_RADIUS}
                />
                <circle
                  cx={line.lastX}
                  cy={line.lastY}
                  fill={line.color}
                  r={CHART_DOT_RADIUS}
                  style={{
                    transformOrigin: '50% 50%',
                    transformBox: 'fill-box' as const,
                    animation: 'embed-pulse 2s ease-in-out infinite',
                  }}
                />
              </g>
            )
          : null
      ))}
    </svg>
  )
}
