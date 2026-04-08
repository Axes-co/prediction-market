'use client'

import type { Event, Market, Outcome } from '@/types'
import Image from 'next/image'
import { useMemo } from 'react'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventOutcomePath, resolveEventPagePath } from '@/lib/events-routing'
import { isHomeEventResolvedLike } from '@/lib/home-events'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTCOME_ICON_SIZE = 30

// ---------------------------------------------------------------------------
// Binary outcome button
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
// Multi-market outcome list / binary outcome buttons
// ---------------------------------------------------------------------------

interface SlideOutcomesProps {
  event: Event
  getDisplayChance: (marketId: string) => number
}

export default function SlideOutcomes({ event, getDisplayChance }: SlideOutcomesProps) {
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
              <p className="truncate text-[15px] font-medium tracking-[-0.01em] text-foreground group-hover:underline">
                {label}
              </p>
            </div>
            <span className="text-[1.75rem] leading-none font-semibold text-foreground">
              {chance}
              %
            </span>
          </AppLink>
        )
      })}
    </div>
  )
}
