'use client'

import type { HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event, Market, Outcome } from '@/types'
import type { PredictionChartCursorSnapshot } from '@/types/PredictionChartTypes'
import { LinkIcon, RepeatIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useCallback, useMemo, useState } from 'react'
import HeroCarouselSlideChart from '@/app/[locale]/(platform)/(home)/_components/HeroCarouselSlideChart'
import SlideCommentMarquee from '@/app/[locale]/(platform)/(home)/_components/SlideCommentMarquee'
import SportsMoneylineButtons from '@/app/[locale]/(platform)/(home)/_components/SportsMoneylineButtons'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import {
  buildChartSeries,
  getTopMarketIds,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import AppLink from '@/components/AppLink'
import EventIconImage from '@/components/EventIconImage'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Button } from '@/components/ui/button'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventOutcomePath, resolveEventPagePath } from '@/lib/events-routing'
import { formatDate, formatVolume } from '@/lib/formatters'
import { isHomeEventResolvedLike } from '@/lib/home-events'
import { buildChanceByMarket } from '@/lib/market-chance'
import { buildHomeSportsMoneylineModel } from '@/lib/sports-home-card'
import { formatSportsDisplayLabel, resolveSportsCompetitionLabel } from '@/lib/sports-labels'
import { parseSportsScore } from '@/lib/sports-resolution'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Props & constants
// ---------------------------------------------------------------------------

interface HeroCarouselSlideProps {
  event: Event
  isActive: boolean
}

const MAX_CHART_SERIES = 4
const OUTCOME_ICON_SIZE = 30

// ---------------------------------------------------------------------------
// Header: standard (multi-outcome) and compact (single/sports)
// ---------------------------------------------------------------------------

function SlideHeaderContent({ event, compact, isSportsLayout }: { event: Event, compact?: boolean, isSportsLayout?: boolean }) {
  const eventPath = resolveEventPagePath(event)
  const isSportsEvent = Boolean(isSportsLayout)

  // Sports breadcrumbs: "Sports · Soccer · Ligue 1"
  const sportLabel = isSportsEvent ? formatSportsDisplayLabel(event.sports_sport_slug) : null
  const competitionLabel = isSportsEvent ? resolveSportsCompetitionLabel(event) : null

  // Standard breadcrumbs: "Politics · Trump"
  const mainTag = !isSportsEvent ? event.tags.find(tag => tag.isMainCategory) : null
  const subTag = !isSportsEvent ? event.tags.find(tag => !tag.isMainCategory && tag.slug !== event.main_tag) : null

  const breadcrumbs = useMemo(() => {
    if (isSportsEvent) {
      const crumbs: { label: string, href: string }[] = [{ label: 'Sports', href: '/sports/live' }]
      if (sportLabel) {
        crumbs.push({ label: sportLabel, href: `/sports/${event.sports_sport_slug}` })
      }
      if (competitionLabel && competitionLabel !== sportLabel) {
        crumbs.push({ label: competitionLabel, href: `/sports/${event.sports_league_slug ?? event.sports_sport_slug}/games` })
      }
      return crumbs
    }

    const crumbs: { label: string, href: string }[] = []
    if (mainTag) {
      crumbs.push({ label: mainTag.name, href: `/${mainTag.slug}` })
    }
    if (subTag && mainTag) {
      crumbs.push({ label: subTag.name, href: `/${mainTag.slug}/${subTag.slug}` })
    }
    return crumbs
  }, [isSportsEvent, sportLabel, competitionLabel, mainTag, subTag, event.sports_sport_slug, event.sports_league_slug])

  return (
    <div className={cn('group relative flex w-full items-center gap-4', !compact && `
      items-start justify-between
      md:pb-1.5
    `)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* Event icon — shown on standard headers, and compact non-sports headers. Sports compact cards omit the icon. */}
        {event.icon_url && (!compact || !isSportsEvent) && (
          <div className="hidden shrink-0 md:block">
            <EventIconImage
              src={event.icon_url}
              alt={event.title}
              sizes="(max-width: 768px) 15vw, (max-width: 1400px) 10vw, 90px"
              containerClassName="rounded-md bg-white size-14 min-w-14"
            />
          </div>
        )}

        <div className={cn('flex min-w-0 flex-1 items-start gap-0.5', compact ? 'flex-col gap-1' : 'flex-col-reverse')}>
          <h2 className={cn(
            'relative w-full min-w-0 font-semibold',
            compact ? 'text-2xl/tight text-pretty' : 'group/title text-2xl text-pretty md:line-clamp-1',
          )}
          >
            <AppLink
              href={eventPath as never}
              className={cn(
                compact
                  ? 'group-hover:underline after:absolute after:inset-0'
                  : 'group-hover/title:underline after:absolute after:inset-0 md:break-all',
              )}
            >
              {event.title}
            </AppLink>
          </h2>

          {breadcrumbs.length > 0 && (
            <div className={cn('relative', compact && 'pointer-events-none')}>
              <div className="flex items-center gap-1 text-muted-foreground">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.href} className="contents">
                    {i > 0 && <span className="text-muted-foreground">&middot;</span>}
                    <AppLink
                      href={crumb.href as never}
                      className="
                        text-sm font-[540] whitespace-nowrap text-muted-foreground transition-colors
                        hover:text-foreground
                      "
                    >
                      {crumb.label}
                    </AppLink>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {!compact && <SlideActions event={event} />}
    </div>
  )
}

function SlideActions({ event }: { event: Event }) {
  const [copied, setCopied] = useState(false)
  const handleCopyLink = useCallback(() => {
    const url = new URL(resolveEventPagePath(event), window.location.origin)
    navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(setCopied, 2000, false)
  }, [event])

  return (
    <div className="relative z-10 hidden shrink-0 items-center gap-1 md:flex">
      <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={handleCopyLink} aria-label="Copy link">
        <LinkIcon className={cn('size-[18px]', copied && 'text-yes')} />
      </Button>
      <EventBookmark event={event} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live indicator (pinging red dot + LIVE text)
// ---------------------------------------------------------------------------

function LiveIndicator({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const t = useExtracted()
  const dotSize = size === 'sm' ? 'size-[5px]' : 'size-[7px]'
  const pingSize = size === 'sm' ? 'size-[7px]' : 'size-[9px]'

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex shrink-0 items-center justify-center">
        <div className={cn(dotSize, 'relative z-10 rounded-full bg-red-500')} />
        <div className={cn('absolute -inset-px animate-ping rounded-full bg-red-500 opacity-75', pingSize)} />
      </div>
      <span className="text-xs font-semibold tracking-normal text-red-500 uppercase">
        {t('Live')}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer: volume + end date / live indicator + platform logo
// ---------------------------------------------------------------------------

function SlideFooter({ event, isSportsLayout }: { event: Event, isSportsLayout: boolean }) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const isLive = Boolean(event.sports_live)
  const isSportsEvent = isSportsLayout
  const hasRecurrence = Boolean(event.series_recurrence)

  // Resolve end date label �� sports cards don't show end date (matches Polymarket)
  const endDateLabel = !isSportsEvent && event.end_date
    ? (() => {
        const d = new Date(event.end_date)
        return Number.isNaN(d.getTime()) ? null : t('Ends {date}', { date: formatDate(d) })
      })()
    : null

  // Resolve recurrence label (e.g., "Monthly", "Weekly")
  const recurrenceLabel = hasRecurrence
    ? event.series_recurrence!.charAt(0).toUpperCase() + event.series_recurrence!.slice(1).toLowerCase()
    : null

  const hasRightContent = isLive || endDateLabel || recurrenceLabel

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground" style={{ opacity: 1 }}>
        {t('{amount} Vol.', { amount: formatVolume(event.volume) })}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isLive && <LiveIndicator />}
        {recurrenceLabel && (
          <div className="flex items-center gap-1.5 pl-1 text-muted-foreground">
            <RepeatIcon className="size-3" />
            <span>{recurrenceLabel}</span>
          </div>
        )}
        {endDateLabel && <span>{endDateLabel}</span>}
        {hasRightContent && <span>&middot;</span>}
        <SiteLogoIcon
          logoSvg={site.logoSvg}
          logoImageUrl={site.logoImageUrl}
          className="
            inline-flex h-4.5 w-auto items-center text-muted-foreground opacity-60
            [&_svg]:h-full [&_svg]:w-auto
          "
          size={18}
          alt={site.name}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart legend (right panel, above chart)
// ---------------------------------------------------------------------------

function SlideChartLegend({
  event,
  cursorSnapshot,
}: {
  event: Event
  cursorSnapshot: PredictionChartCursorSnapshot | null
}) {
  const chances = useMemo(() => buildChanceByMarket(event.markets), [event.markets])
  const topMarketIds = useMemo(() => getTopMarketIds(chances, MAX_CHART_SERIES), [chances])
  const series = useMemo(() => buildChartSeries(event, topMarketIds), [event, topMarketIds])

  // Merge cursor hover values with baseline chances — same pattern as EventChart
  const legendEntries = useMemo(
    () => series.map((entry) => {
      const hoveredValue = cursorSnapshot?.values?.[entry.key]
      const baselineValue = chances[entry.key] ?? 0
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : baselineValue
      return { ...entry, value }
    }),
    [series, cursorSnapshot, chances],
  )

  if (legendEntries.length === 0) {
    return null
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {legendEntries.map(entry => (
          <div key={entry.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <div className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <p className="text-sm text-muted-foreground">
              {entry.name}
              <span className="ml-0.5 font-semibold text-foreground">
                &nbsp;
                {Number.isInteger(entry.value) ? `${entry.value}%` : `${entry.value.toFixed(1)}%`}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-market outcome list
// ---------------------------------------------------------------------------

function SlideOutcomes({
  event,
  getDisplayChance,
}: {
  event: Event
  getDisplayChance: (marketId: string) => number
}) {
  const isResolvedEvent = isHomeEventResolvedLike(event)
  const marketsToDisplay = useMemo(() => {
    if (isResolvedEvent) {
      return event.markets
    }
    const active = event.markets.filter(m => !m.is_resolved && !m.condition?.resolved)
    return active.length > 0 ? active : event.markets
  }, [event.markets, isResolvedEvent])

  const isSingleMarket = marketsToDisplay.length === 1
  const primaryMarket = marketsToDisplay[0]
  const showMarketIcons = event.show_market_icons && event.markets.some(m => m.icon_url)
  const eventPath = resolveEventPagePath(event)

  // Single market → two big outcome buttons
  if (isSingleMarket && primaryMarket) {
    const yesOutcome = primaryMarket.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.YES) ?? primaryMarket.outcomes[0]
    const noOutcome = primaryMarket.outcomes.find(o => o.outcome_index === OUTCOME_INDEX.NO) ?? primaryMarket.outcomes[1]
    const yesChance = Math.round(getDisplayChance(primaryMarket.condition_id))
    const noChance = 100 - yesChance

    return (
      <div className="flex gap-2">
        {yesOutcome && <OutcomeButton event={event} market={primaryMarket} outcome={yesOutcome} chance={yesChance} variant="yes" />}
        {noOutcome && <OutcomeButton event={event} market={primaryMarket} outcome={noOutcome} chance={noChance} variant="no" />}
      </div>
    )
  }

  // Multi-market → outcome rows
  return (
    <div className="flex flex-col gap-2 rounded-lg">
      {marketsToDisplay.slice(0, 4).map((market) => {
        const chance = Math.round(getDisplayChance(market.condition_id))
        const label = market.short_title || market.outcomes?.[0]?.outcome_text || market.title
        const marketPath = market.slug ? `${eventPath}/${market.slug}` : eventPath

        return (
          <AppLink
            key={market.condition_id}
            href={marketPath as never}
            className="group flex min-h-10 items-center justify-between gap-3 border-b border-border pb-2"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {showMarketIcons && market.icon_url && (
                <div className="shrink-0">
                  <div className="relative overflow-hidden rounded-xs bg-white" style={{ width: OUTCOME_ICON_SIZE, height: OUTCOME_ICON_SIZE, minWidth: OUTCOME_ICON_SIZE }}>
                    <Image src={market.icon_url} alt={label} fill className="object-cover" sizes="30px" />
                  </div>
                </div>
              )}
              <p className="truncate text-[15px] font-[450] tracking-[-0.01em] text-foreground group-hover:underline">
                {label}
              </p>
            </div>
            <span className="text-2xl font-semibold text-foreground">
              {chance}
              %
            </span>
          </AppLink>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Binary outcome buttons — reuses Button component with yes/no variants
// Same pattern as EventCardSingleMarketActions
// ---------------------------------------------------------------------------

function OutcomeButton({
  event,
  market,
  outcome,
  chance,
  variant,
}: {
  event: Event
  market: Market
  outcome: Outcome
  chance: number
  variant: 'yes' | 'no'
}) {
  const href = resolveEventOutcomePath(event, {
    marketSlug: market.slug,
    conditionId: market.condition_id,
    outcomeIndex: outcome.outcome_index,
  })

  return (
    <Button asChild variant={variant} className="h-14 flex-1 gap-1.5 text-lg font-bold tabular-nums">
      <AppLink href={href as never}>
        <span className="truncate uppercase">{outcome.outcome_text ?? (variant === 'yes' ? 'Yes' : 'No')}</span>
        <span>
          {chance}
          %
        </span>
      </AppLink>
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Sports moneyline buttons — uses shared SportsMoneylineButtons component
// ---------------------------------------------------------------------------

const HERO_SPORTS_BUTTON_HEIGHT = 'h-14'

// ---------------------------------------------------------------------------
// Sports scoreboard (right panel, above chart for live sports events)
// ---------------------------------------------------------------------------

function SportsScoreboard({
  event,
  model,
}: {
  event: Event
  model: HomeSportsMoneylineModel
}) {
  const score = useMemo(() => parseSportsScore(event.sports_score), [event.sports_score])
  const isLive = Boolean(event.sports_live)

  const periodLabel = useMemo(() => {
    const parts: string[] = []
    if (event.sports_period) {
      parts.push(event.sports_period)
    }
    if (event.sports_elapsed) {
      parts.push(event.sports_elapsed)
    }
    return parts.join(' - ')
  }, [event.sports_period, event.sports_elapsed])

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end justify-center gap-10">
        {/* Team 1 */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
          <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-md">
            {model.team1.logoUrl
              ? (
                  <Image
                    src={model.team1.logoUrl}
                    alt={model.team1.abbreviation}
                    fill
                    sizes="48px"
                    className="object-contain"
                  />
                )
              : (
                  <span className="text-lg font-bold text-muted-foreground">{model.team1.abbreviation}</span>
                )}
          </div>
          <span className="block w-full text-center text-base font-medium break-normal text-foreground">
            {model.team1.abbreviation}
          </span>
        </div>

        {/* Score center */}
        <div className="flex w-[140px] flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[2rem] font-medium tabular-nums">
                  {score?.team1 ?? 0}
                </span>
              </div>
              <span className="mb-5 h-1 w-3 rounded-full bg-muted-foreground/30" />
              <div className="flex flex-col items-start gap-1">
                <span className="text-[2rem] font-medium tabular-nums">
                  {score?.team2 ?? 0}
                </span>
              </div>
            </div>

            {isLive && (
              <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold whitespace-nowrap text-red-500">
                <LiveIndicator size="sm" />
                {periodLabel && <span className="font-medium">{periodLabel}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
          <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-md">
            {model.team2.logoUrl
              ? (
                  <Image
                    src={model.team2.logoUrl}
                    alt={model.team2.abbreviation}
                    fill
                    sizes="48px"
                    className="object-contain"
                  />
                )
              : (
                  <span className="text-lg font-bold text-muted-foreground">{model.team2.abbreviation}</span>
                )}
          </div>
          <span className="block w-full text-center text-base font-medium break-normal text-foreground">
            {model.team2.abbreviation}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main slide component
// ---------------------------------------------------------------------------

export default function HeroCarouselSlide({ event, isActive }: HeroCarouselSlideProps) {
  const homeSportsMoneylineModel = useMemo(() => buildHomeSportsMoneylineModel(event), [event])
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const chanceByMarket = useMemo(() => buildChanceByMarket(event.markets), [event.markets])
  const getDisplayChance = useCallback((marketId: string) => chanceByMarket[marketId] ?? 0, [chanceByMarket])

  // Only sports moneyline cards use compact headers (header inside left panel, no actions).
  // All other cards — including regular single-market Yes/No — use the standard header above body.
  const useCompactHeader = Boolean(homeSportsMoneylineModel)

  return (
    <div className={cn('relative flex size-full flex-col', useCompactHeader ? 'gap-2' : 'gap-4')}>
      {/* Full-bleed click target */}
      <AppLink href={resolveEventPagePath(event) as never} className="absolute inset-0" aria-hidden="true" tabIndex={-1} />

      {/* Standard header — multi-market events only */}
      {!useCompactHeader && <SlideHeaderContent event={event} />}

      {/* Mobile compact header for sports */}
      {useCompactHeader && (
        <div className="lg:hidden">
          <SlideHeaderContent event={event} compact isSportsLayout />
        </div>
      )}

      {/* Body: left panel + right panel */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:flex-row lg:gap-6">
        {/* LEFT 40% */}
        <div className="relative flex flex-col gap-4 lg:w-[40%] lg:justify-between">
          {useCompactHeader && (
            <div className="hidden lg:block">
              <SlideHeaderContent event={event} compact isSportsLayout />
            </div>
          )}

          {homeSportsMoneylineModel
            ? <SportsMoneylineButtons event={event} model={homeSportsMoneylineModel} heightClass={HERO_SPORTS_BUTTON_HEIGHT} />
            : <SlideOutcomes event={event} getDisplayChance={getDisplayChance} />}

          {/* Comment marquee */}
          <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
            <SlideCommentMarquee event={event} />
          </div>
        </div>

        {/* RIGHT 60% — sports scoreboard + chart  OR  legend + chart */}
        <div className="relative hidden h-full min-h-0 flex-1 flex-col justify-center lg:flex">
          {homeSportsMoneylineModel
            ? (
                <>
                  <SportsScoreboard event={event} model={homeSportsMoneylineModel} />
                  <div className="hidden min-h-0 flex-1 lg:block">
                    <div className="relative size-full">
                      <div className="relative size-full">
                        <div className="absolute inset-0 overflow-hidden pt-2">
                          <div className="flex size-full flex-col">
                            <div className="mt-7 min-h-0 flex-1">
                              <HeroCarouselSlideChart event={event} isActive={isActive} onCursorDataChange={setCursorSnapshot} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            : (
                <div className="min-h-0 flex-1">
                  <div className="relative size-full">
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="flex size-full flex-col">
                        <SlideChartLegend event={event} cursorSnapshot={cursorSnapshot} />
                        <div className="mt-7 min-h-0 flex-1">
                          <HeroCarouselSlideChart event={event} isActive={isActive} onCursorDataChange={setCursorSnapshot} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
        </div>
      </div>

      <SlideFooter event={event} isSportsLayout={useCompactHeader} />
    </div>
  )
}
