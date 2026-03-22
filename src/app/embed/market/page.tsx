import type { Metadata } from 'next'
import type { EmbedOutcome } from '@/components/embed/MarketEmbedCard'
import type { EmbedTheme } from '@/lib/embed-theme'
import type { SupportedLocale } from '@/i18n/locales'
import { Suspense } from 'react'
import { eq } from 'drizzle-orm'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/locales'
import MarketEmbedCard from '@/components/embed/MarketEmbedCard'
import { OUTCOME_INDEX } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { markets as marketsTable } from '@/lib/db/schema/events/tables'
import { db } from '@/lib/drizzle'
import { buildEmbedChart, fetchEmbedPriceHistory } from '@/lib/embed-chart'
import {
  CHART_VIEWBOX_WIDTH,
  clampDimension,
  DEFAULT_EMBED_HEIGHT,
  DEFAULT_EMBED_WIDTH,
  MAX_EMBED_HEIGHT,
  MAX_EMBED_WIDTH,
  MIN_EMBED_HEIGHT,
  MIN_EMBED_WIDTH,
  resolveChartViewBoxHeight,
} from '@/lib/embed-dimensions'
import { resolveChartLineColor, resolveEmbedPalette } from '@/lib/embed-theme'
import {
  buildEventPath,
  buildMarketUrl,
  isMultiOutcomeMarket,
  isValidHexColor,
  normalizeBaseUrl,
  normalizeOutcomePrice,
  parseBoolParam,
} from '@/lib/embed-utils'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbedSearchParams {
  market?: string
  event?: string
  theme?: string
  width?: string
  height?: string
  showChart?: string
  showButtons?: string
  showVolume?: string
  showYAxis?: string
  showGridRows?: string
  showBorder?: string
  locale?: string
  r?: string
  rotate?: string
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Market Embed',
  description: 'Embeddable prediction market widget',
  robots: 'noindex, nofollow',
}

// ---------------------------------------------------------------------------
// Data resolution
// ---------------------------------------------------------------------------

async function resolveMarketBySlug(slug: string, locale: SupportedLocale) {
  const marketRecord = await db.query.markets.findFirst({
    where: eq(marketsTable.slug, slug),
    with: { event: { columns: { slug: true } } },
  })

  if (!marketRecord?.event?.slug) return null

  const { data: event } = await EventRepository.getEventBySlug(marketRecord.event.slug, '', locale)
  if (!event) return null

  const market = event.markets.find(m => m.slug === slug)
  if (!market) return null

  return { market, event }
}

async function resolveEventBySlug(slug: string, locale: SupportedLocale) {
  const { data: event } = await EventRepository.getEventBySlug(slug, '', locale)
  return event ?? null
}

// ---------------------------------------------------------------------------
// Not-found placeholder
// ---------------------------------------------------------------------------

function NotFoundPlaceholder({ width, height, theme }: { width: number, height: number, theme: EmbedTheme }) {
  const palette = resolveEmbedPalette(theme)
  return (
    <div
      className="flex items-center justify-center rounded-2xl text-sm"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: palette.bg,
        color: palette.muted,
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
      }}
    >
      Market not found
    </div>
  )
}

// ---------------------------------------------------------------------------
// Async content (wrapped in Suspense by the page)
// ---------------------------------------------------------------------------

async function EmbedMarketContent({
  searchParams,
}: {
  searchParams: Promise<EmbedSearchParams>
}) {
  const params = await searchParams
  const marketSlug = params.market?.trim() ?? ''
  const eventSlug = params.event?.trim() ?? ''
  const theme: EmbedTheme = params.theme === 'dark' ? 'dark' : 'light'
  const width = clampDimension(params.width, DEFAULT_EMBED_WIDTH, MIN_EMBED_WIDTH, MAX_EMBED_WIDTH)
  const height = clampDimension(params.height, DEFAULT_EMBED_HEIGHT, MIN_EMBED_HEIGHT, MAX_EMBED_HEIGHT)
  const showChart = parseBoolParam(params.showChart, true)
  const showButtons = parseBoolParam(params.showButtons, true)
  const showVolume = parseBoolParam(params.showVolume, true)
  const showYAxis = parseBoolParam(params.showYAxis, true)
  const showGridRows = parseBoolParam(params.showGridRows, true)
  const showBorder = parseBoolParam(params.showBorder, false)
  const affiliateCode = params.r?.trim() ?? ''
  const embedLocale = params.locale?.trim() ?? ''
  const resolvedLocale: SupportedLocale = SUPPORTED_LOCALES.includes(embedLocale as SupportedLocale)
    ? embedLocale as SupportedLocale
    : DEFAULT_LOCALE

  // Resolve site identity
  const runtimeTheme = await loadRuntimeThemeState()
  const siteName = runtimeTheme.site.name || 'Kuest'
  const siteUrl = normalizeBaseUrl(process.env.SITE_URL ?? '')
  const logoSvg = runtimeTheme.site.logoSvg

  // Resolve market data
  let market = null
  let event = null

  if (marketSlug) {
    const result = await resolveMarketBySlug(marketSlug, resolvedLocale)
    if (result) {
      market = result.market
      event = result.event
    }
  }
  else if (eventSlug) {
    const resolvedEvent = await resolveEventBySlug(eventSlug, resolvedLocale)
    if (resolvedEvent && resolvedEvent.markets.length > 0) {
      event = resolvedEvent
      market = resolvedEvent.markets.find(m => m.is_active) ?? resolvedEvent.markets[0]
    }
  }

  if (!market || !event) {
    return <NotFoundPlaceholder width={width} height={height} theme={theme} />
  }

  // Build outcomes with icons/colors from event data
  const sortedOutcomes = [...(market.outcomes ?? [])].sort(
    (a, b) => (a.outcome_index ?? 0) - (b.outcome_index ?? 0),
  )

  const sportsTeams = event.sports_teams ?? []
  const teamLogoUrls = event.sports_team_logo_urls ?? []

  const outcomes: EmbedOutcome[] = sortedOutcomes.map((outcome, index) => {
    const team = sportsTeams[index]
    const teamLogoUrl = teamLogoUrls[index] ?? team?.logo_url ?? null
    const teamColor = isValidHexColor(team?.color) ? team.color : null
    const label = team?.name ?? (outcome.outcome_text || (index === 0 ? 'Yes' : 'No'))

    return {
      label,
      price: normalizeOutcomePrice(outcome),
      outcomeIndex: outcome.outcome_index ?? index,
      iconUrl: teamLogoUrl,
      color: teamColor ?? resolveChartLineColor(index),
    }
  })

  const multiOutcome = isMultiOutcomeMarket(outcomes)

  // Strip icons/colors for binary markets (they use simple green/red)
  const resolvedOutcomes: EmbedOutcome[] = multiOutcome
    ? outcomes
    : outcomes.map(o => ({ ...o, iconUrl: null, color: undefined }))

  // Build market URL with UTM
  const eventPath = buildEventPath(event, resolvedLocale)
  const marketUrl = buildMarketUrl(siteUrl, eventPath, 'market', affiliateCode)

  // Fetch price history and build chart
  let chartData = null
  if (showChart) {
    const viewBoxHeight = resolveChartViewBoxHeight(height, multiOutcome)

    if (!multiOutcome) {
      // Binary: single line for YES outcome
      const yesOutcome = sortedOutcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES) ?? sortedOutcomes[0]
      if (yesOutcome?.token_id) {
        const points = await fetchEmbedPriceHistory(yesOutcome.token_id, event.created_at, event.resolved_at)
        if (points.length > 0) {
          chartData = buildEmbedChart(
            [{ key: market.condition_id, color: resolveChartLineColor(0), points }],
            CHART_VIEWBOX_WIDTH,
            viewBoxHeight,
          )
        }
      }
    }
    else {
      // Multi-outcome: one line per outcome
      const seriesResults = await Promise.all(
        sortedOutcomes.map(async (outcome, index) => {
          if (!outcome.token_id) return null
          const points = await fetchEmbedPriceHistory(outcome.token_id, event.created_at, event.resolved_at)
          if (points.length === 0) return null
          return {
            key: `${market.condition_id}-${outcome.outcome_index}`,
            color: outcomes[index]?.color ?? resolveChartLineColor(index),
            points,
          }
        }),
      )

      const validSeries = seriesResults.filter((s): s is NonNullable<typeof s> => s !== null)
      if (validSeries.length > 0) {
        chartData = buildEmbedChart(validSeries, CHART_VIEWBOX_WIDTH, viewBoxHeight)
      }
    }
  }

  return (
    <MarketEmbedCard
      title={market.question || market.title || market.slug}
      iconUrl={market.icon_url || event.icon_url || ''}
      marketUrl={marketUrl}
      siteUrl={siteUrl}
      siteName={siteName}
      logoSvg={logoSvg}
      outcomes={resolvedOutcomes}
      chart={chartData}
      volume={Number(market.volume ?? 0)}
      theme={theme}
      width={width}
      height={height}
      showChart={showChart}
      showButtons={showButtons}
      showVolume={showVolume}
      showYAxis={showYAxis}
      showGridRows={showGridRows}
      showBorder={showBorder}
      startTime={event.sports_start_time ?? event.start_date ?? null}
    />
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function EmbedMarketPage({
  searchParams,
}: {
  searchParams: Promise<EmbedSearchParams>
}) {
  return (
    <Suspense>
      <EmbedMarketContent searchParams={searchParams} />
    </Suspense>
  )
}
