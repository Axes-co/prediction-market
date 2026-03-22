import type { EmbedChartData } from '@/lib/embed-chart'
import type { EmbedTheme } from '@/lib/embed-theme'
import EmbedChartCrosshair from '@/components/embed/EmbedChartCrosshair'
import {
  BANNER_ICON_SIZE_PX,
  BANNER_PADDING,
  BANNER_TITLE_MAX_WIDTH,
  CARD_PADDING,
  CARD_PADDING_MULTI_OUTCOME,
  MARKET_ICON_SIZE_PX,
  PRICE_LABEL_FONT_SIZE,
  PRICE_LABEL_STROKE_WIDTH,
  PRICE_LABEL_X_SCALE,
  PRICE_LABEL_Y_SCALE,
  TITLE_FONT_SIZE,
  isBannerLayout,
} from '@/lib/embed-dimensions'
import { resolveEmbedPalette } from '@/lib/embed-theme'
import { isMultiOutcomeMarket } from '@/lib/embed-utils'
import { formatVolume } from '@/lib/formatters'
import EmbedHeader from '@/components/embed/EmbedHeader'
import EmbedOutcomeButtons from '@/components/embed/EmbedOutcomeButtons'
import EmbedSvgChart from '@/components/embed/EmbedSvgChart'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedOutcome {
  label: string
  price: number
  outcomeIndex: number
  color?: string | null
  iconUrl?: string | null
}

export interface MarketEmbedCardProps {
  title: string
  iconUrl: string
  marketUrl: string
  siteUrl: string
  siteName: string
  logoSvg: string
  outcomes: EmbedOutcome[]
  chart: EmbedChartData | null
  volume: number
  theme: EmbedTheme
  width: number
  height: number
  showChart?: boolean
  showButtons?: boolean
  showVolume?: boolean
  showYAxis?: boolean
  showGridRows?: boolean
  showBorder?: boolean
  /** When set, renders a countdown in the header (for scheduled events) */
  startTime?: string | null
  /** Translated UI labels for the widget */
  labels?: EmbedLabels
}

export interface EmbedLabels {
  viewMarket: string
  allTime: string
  viewOn: string
}

const DEFAULT_LABELS: EmbedLabels = {
  viewMarket: 'View Market',
  allTime: 'All time',
  viewOn: 'View on',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CountdownLabel({ startTime, color }: { startTime: string, color: string }) {
  const startMs = new Date(startTime).getTime()
  const diffMs = startMs - Date.now()

  let label: string
  if (diffMs <= 0) {
    label = 'Live'
  }
  else {
    const totalMinutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)
    if (days > 0) label = `Starts in ${days}d ${hours % 24}h`
    else if (hours > 0) label = `Starts in ${hours}h ${minutes}m`
    else label = `Starts in ${minutes}m`
  }

  return (
    <span className="flex items-center gap-1 text-xs font-medium tracking-wider" style={{ color }}>
      <svg height="12" width="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
        <path d="m10.75,8.25c-.828,0-1.5-.672-1.5-1.5v-2.75c0-1.795-1.455-3.25-3.25-3.25-1.795,0-3.25,1.455-3.25,3.25v2.75c0,.828-.672,1.5-1.5,1.5h9.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="m6,12c1.105,0,2-.895,2-2h-4c0,1.105.895,2,2,2Z" fill="currentColor" strokeWidth="0" />
      </svg>
      <span>{label}</span>
    </span>
  )
}

function PriceLabel({ lines, strokeBg }: { lines: EmbedChartData['lines'], strokeBg: string }) {
  if (lines.length === 0) return null
  const primary = lines[0]

  return (
    <div
      className="absolute left-1 top-0 pointer-events-none z-10"
      style={{
        transform: `translateX(${primary.lastX * PRICE_LABEL_X_SCALE}px) translateY(${primary.lastY * PRICE_LABEL_Y_SCALE}px)`,
      }}
    >
      <span
        className="font-semibold leading-none whitespace-nowrap"
        style={{
          WebkitTextStroke: `${PRICE_LABEL_STROKE_WIDTH} ${strokeBg}`,
          fontSize: PRICE_LABEL_FONT_SIZE,
          color: primary.color,
          paintOrder: 'stroke',
        }}
      >
        {primary.lastPercent}%
      </span>
    </div>
  )
}

function VolumeRow({ volume, marketUrl, color, allTimeLabel }: { volume: number, marketUrl: string, color: string, allTimeLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium" style={{ color }}>
        {formatVolume(volume)}
        {' '}
        Vol.
      </span>
      <a
        className="flex items-center gap-1 text-xs font-medium no-underline"
        style={{ color }}
        href={marketUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>{allTimeLabel}</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </a>
    </div>
  )
}

function MultiOutcomeRows({ outcomes, fg }: { outcomes: EmbedOutcome[], fg: string }) {
  return (
    <div className="flex flex-col gap-1">
      {outcomes.map(outcome => (
        <div key={outcome.outcomeIndex} className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {outcome.iconUrl && (
              <img className="w-8 h-8 object-contain shrink-0" alt={outcome.label} src={outcome.iconUrl} />
            )}
            <span className="text-lg font-semibold tracking-tight truncate" style={{ color: fg }}>
              {outcome.label}
            </span>
          </div>
          <span
            className="text-lg font-semibold tracking-tight shrink-0 ml-2"
            style={{ color: outcome.color ?? fg }}
          >
            {Math.round(outcome.price * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart section (shared between card and banner)
// ---------------------------------------------------------------------------

function ChartSection({
  chart, theme, showYAxis, showGridRows, showVolume, volume, marketUrl, palette, multiOutcome, allTimeLabel,
}: {
  chart: EmbedChartData
  theme: EmbedTheme
  showYAxis: boolean
  showGridRows: boolean
  showVolume: boolean
  volume: number
  marketUrl: string
  palette: ReturnType<typeof resolveEmbedPalette>
  multiOutcome: boolean
  allTimeLabel: string
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-col gap-1 w-full flex-1 min-h-0">
        <EmbedChartCrosshair
          chart={chart}
          strokeBg={palette.priceStrokeBg}
          svgChart={<EmbedSvgChart chart={chart} showYAxis={showYAxis} showGridRows={showGridRows} theme={theme} />}
          staticLabel={!multiOutcome && chart.lines.length > 0
            ? <PriceLabel lines={chart.lines} strokeBg={palette.priceStrokeBg} />
            : undefined}
        />
        {showVolume && <VolumeRow volume={volume} marketUrl={marketUrl} color={palette.muted} allTimeLabel={allTimeLabel} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner layout
// ---------------------------------------------------------------------------

function BannerLayout(props: MarketEmbedCardProps) {
  const { title, iconUrl, marketUrl, siteName, logoSvg, outcomes, chart, volume, theme, width, height, showChart, showButtons, showVolume, labels: rawLabels } = props
  const palette = resolveEmbedPalette(theme)
  const labels = rawLabels ?? DEFAULT_LABELS

  const outcomeButtons = outcomes.map(o => ({ ...o, marketUrl }))

  return (
    <div
      className="flex items-center gap-1 rounded-2xl overflow-hidden"
      style={{
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        padding: BANNER_PADDING,
        width: `${width}px`,
        maxWidth: '100%',
        height: `${height}px`,
        boxSizing: 'border-box',
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      <div className="flex items-center gap-1 w-full h-full">
        {iconUrl && (
          <img
            className="rounded-xl object-cover shrink-0"
            alt={title}
            src={iconUrl}
            style={{ height: BANNER_ICON_SIZE_PX, width: BANNER_ICON_SIZE_PX }}
          />
        )}

        <div className="flex flex-col justify-center gap-1 shrink-0 px-2" style={{ maxWidth: BANNER_TITLE_MAX_WIDTH }}>
          <p className="font-bold leading-snug line-clamp-2 text-sm" style={{ color: palette.fg, margin: 0 }}>
            {title}
          </p>
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color: palette.muted }}>
            {showVolume !== false && (
              <>
                <span>{formatVolume(volume)} Vol.</span>
                <span>·</span>
              </>
            )}
            <span>{labels.viewOn}</span>
            <EmbedHeader siteName={siteName} logoSvg={logoSvg} marketUrl={marketUrl} theme={theme} inline viewMarketLabel={labels.viewMarket} />
          </div>
        </div>

        {showChart !== false && chart && chart.lines.length > 0 && (
          <div className="flex-1 min-w-0 flex flex-col" style={{ height: BANNER_ICON_SIZE_PX }}>
            <div className="flex flex-col gap-1 w-full flex-1 min-h-0">
              <EmbedChartCrosshair
                chart={chart}
                strokeBg={palette.priceStrokeBg}
                svgChart={<EmbedSvgChart chart={chart} showYAxis={false} showGridRows={false} theme={theme} />}
                staticLabel={chart.lines.length > 0
                  ? <PriceLabel lines={chart.lines} strokeBg={palette.priceStrokeBg} />
                  : undefined}
              />
            </div>
          </div>
        )}

        {showButtons !== false && (
          <EmbedOutcomeButtons outcomes={outcomeButtons} theme={theme} stacked />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card layout (binary + multi-outcome + head-to-head)
// ---------------------------------------------------------------------------

function CardLayout(props: MarketEmbedCardProps) {
  const {
    title, iconUrl, marketUrl, siteName, logoSvg,
    outcomes, chart, volume, theme,
    width, height, startTime,
    showChart, showButtons, showVolume, showYAxis, showGridRows,
    labels: rawLabels,
  } = props

  const palette = resolveEmbedPalette(theme)
  const labels = rawLabels ?? DEFAULT_LABELS
  const multiOutcome = isMultiOutcomeMarket(outcomes)
  const hasStartTime = Boolean(startTime)
  const padding = multiOutcome ? CARD_PADDING_MULTI_OUTCOME : CARD_PADDING

  const outcomeButtons = outcomes.map(o => ({
    ...o,
    marketUrl,
    color: multiOutcome ? o.color : undefined,
  }))

  return (
    <div
      className={`flex flex-col rounded-2xl ${multiOutcome ? 'gap-3' : 'gap-2'}`}
      style={{
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        padding,
        overflow: 'hidden',
        width: `${width}px`,
        maxWidth: '100%',
        height: `${height}px`,
        boxSizing: 'border-box',
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      {/* Header — countdown + logo for scheduled events, standard otherwise */}
      {hasStartTime
        ? (
            <div className="flex items-center justify-between">
              <a
                className="flex items-center no-underline"
                style={{ color: palette.muted }}
                href={marketUrl}
                rel="noopener"
                target="_blank"
              >
                <CountdownLabel startTime={startTime!} color={palette.muted} />
              </a>
              <EmbedHeader siteName={siteName} logoSvg={logoSvg} marketUrl={marketUrl} theme={theme} viewMarketLabel={labels.viewMarket} />
            </div>
          )
        : <EmbedHeader siteName={siteName} logoSvg={logoSvg} marketUrl={marketUrl} theme={theme} viewMarketLabel={labels.viewMarket} />}

      <div className="flex flex-col gap-2 flex-1 min-h-0">
        {/* Market info — outcome rows for multi-outcome, image+title for binary */}
        {multiOutcome
          ? <MultiOutcomeRows outcomes={outcomes} fg={palette.fg} />
          : (
              <div className="flex items-center justify-between gap-3">
                <a className="flex items-start gap-3 no-underline flex-1 min-w-0" href={marketUrl} rel="noopener" target="_blank">
                  {iconUrl && (
                    <img
                      className="rounded-lg object-cover shrink-0"
                      alt={title}
                      src={iconUrl}
                      style={{ width: MARKET_ICON_SIZE_PX, height: MARKET_ICON_SIZE_PX }}
                    />
                  )}
                  <p className="font-bold leading-snug line-clamp-3" style={{ fontSize: TITLE_FONT_SIZE, color: palette.fg, margin: 0 }}>
                    {title}
                  </p>
                </a>
              </div>
            )}

        {/* Chart */}
        {showChart !== false && chart && chart.lines.length > 0
          ? (
              <ChartSection
                chart={chart}
                theme={theme}
                showYAxis={showYAxis !== false}
                showGridRows={showGridRows !== false}
                showVolume={showVolume !== false}
                volume={volume}
                marketUrl={marketUrl}
                palette={palette}
                multiOutcome={multiOutcome}
                allTimeLabel={labels.allTime}
              />
            )
          : showVolume !== false
            ? <VolumeRow volume={volume} marketUrl={marketUrl} color={palette.muted} allTimeLabel={labels.allTime} />
            : null}

        {/* Outcome buttons */}
        {showButtons !== false && (
          <EmbedOutcomeButtons outcomes={outcomeButtons} theme={theme} teamStyle={multiOutcome} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PULSE_KEYFRAMES = `
@keyframes embed-pulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(3); }
}`

export default function MarketEmbedCard(props: MarketEmbedCardProps) {
  const { width, height, showBorder, theme } = props
  const banner = isBannerLayout(width, height)
  const palette = resolveEmbedPalette(theme)

  const borderStyle = showBorder
    ? { border: `1px solid ${palette.border}`, borderRadius: '16px' }
    : undefined

  return (
    <div style={borderStyle}>
      <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />
      {banner ? <BannerLayout {...props} /> : <CardLayout {...props} />}
    </div>
  )
}
