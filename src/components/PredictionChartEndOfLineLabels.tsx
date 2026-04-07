import type { DataPoint, SeriesConfig } from '@/types/PredictionChartTypes'

interface EndOfLineLabelEntry {
  key: string
  name: string
  color: string
  value: number
  x: number
  y: number
}

interface PredictionChartEndOfLineLabelsProps {
  entries: EndOfLineLabelEntry[]
  isDarkMode: boolean
  visible: boolean
  nameSize?: number
  valueSize?: number
  strokeWidth?: number
  strokeColor?: string
}

const DEFAULT_NAME_SIZE = 13
const DEFAULT_VALUE_SIZE = 26
const DEFAULT_STROKE_WIDTH = 3
const LABEL_GAP_X = 14

function resolveStrokeColor(isDarkMode: boolean, override?: string) {
  if (override) {
    return override
  }
  return isDarkMode ? '#15191d' : '#ffffff'
}

/**
 * Build label entries from the last data point, positioned at each series' actual
 * endpoint on the chart — matching Polymarket's approach where labels sit at the
 * line's end coordinate, not at a fixed right margin.
 */
export function buildEndOfLineLabelEntries(
  data: DataPoint[],
  series: SeriesConfig[],
  margin: { top: number, left: number },
  xScale: (date: Date) => number,
  yScale: (value: number) => number,
): EndOfLineLabelEntry[] {
  const lastDataPoint = data.at(-1)
  if (!lastDataPoint) {
    return []
  }

  const entries: EndOfLineLabelEntry[] = []
  const lastX = xScale(lastDataPoint.date)

  for (const seriesItem of series) {
    const value = lastDataPoint[seriesItem.key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue
    }

    entries.push({
      key: seriesItem.key,
      name: seriesItem.name,
      color: seriesItem.color,
      value,
      x: margin.left + lastX + LABEL_GAP_X,
      y: margin.top + yScale(value),
    })
  }

  return entries
}

export default function PredictionChartEndOfLineLabels({
  entries,
  isDarkMode,
  visible,
  nameSize = DEFAULT_NAME_SIZE,
  valueSize = DEFAULT_VALUE_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  strokeColor,
}: PredictionChartEndOfLineLabelsProps) {
  if (!visible || entries.length === 0) {
    return null
  }

  const resolvedStrokeColor = resolveStrokeColor(isDarkMode, strokeColor)

  return entries.map(entry => (
    <div
      key={`${entry.key}-eol-label`}
      className="pointer-events-none absolute top-0 left-0"
      style={{
        transform: `translateX(${entry.x}px) translateY(${entry.y}px)`,
      }}
    >
      <p
        className="leading-[14px] font-medium whitespace-nowrap"
        style={{
          fontSize: nameSize,
          color: entry.color,
          WebkitTextStroke: `${strokeWidth}px ${resolvedStrokeColor}`,
          paintOrder: 'stroke',
        }}
      >
        {entry.name}
      </p>
      <p
        className="leading-none font-semibold"
        style={{
          fontSize: valueSize,
          color: entry.color,
          WebkitTextStroke: `${strokeWidth}px ${resolvedStrokeColor}`,
          paintOrder: 'stroke',
        }}
      >
        {Math.round(entry.value)}
        %
      </p>
    </div>
  ))
}
