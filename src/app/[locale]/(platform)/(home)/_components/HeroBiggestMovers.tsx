'use client'

import type { Event } from '@/types'
import { ChevronRightIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import AppLink from '@/components/AppLink'
import { resolveEventPagePath } from '@/lib/events-routing'

interface HeroBiggestMoversProps {
  events: Event[]
}

interface MoverEntry {
  event: Event
  displayChance: number
  volume24h: number
}

function resolvePrimaryMover(event: Event): MoverEntry | null {
  const activeMarkets = event.markets.filter(m => !m.is_resolved && m.is_active)
  const market = activeMarkets.length > 0
    ? activeMarkets.reduce((top, m) => (m.volume_24h > top.volume_24h ? m : top), activeMarkets[0])
    : event.markets[0]

  if (!market) {
    return null
  }

  const rawPrice = market.price ?? market.probability ?? 0
  const currentChance = Math.round(rawPrice > 1 ? rawPrice : rawPrice * 100)

  return {
    event,
    displayChance: Math.max(0, Math.min(100, currentChance)),
    volume24h: market.volume_24h ?? 0,
  }
}

export default function HeroBiggestMovers({ events }: HeroBiggestMoversProps) {
  const t = useExtracted()
  const movers = useMemo(() => {
    return events
      .map(resolvePrimaryMover)
      .filter((entry): entry is MoverEntry => entry !== null)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 3)
  }, [events])

  if (movers.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg">
      <AppLink href={'/predictions?_sort=trending' as never} className="group flex items-center gap-1 hover:underline">
        <h2 className="text-lg font-semibold text-foreground">{t('Biggest movers')}</h2>
        <ChevronRightIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </AppLink>

      <div className="flex flex-col">
        {movers.map((mover, index) => (
          <AppLink
            key={mover.event.id}
            href={resolveEventPagePath(mover.event) as never}
            className="group flex items-start gap-4 py-2.5"
          >
            <div className="pt-0.5 text-sm font-semibold text-muted-foreground tabular-nums">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:underline">
                {mover.event.title}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 text-right">
              <span className="text-lg leading-none font-semibold text-foreground">
                {mover.displayChance}
                %
              </span>
            </div>
          </AppLink>
        ))}
      </div>
    </div>
  )
}
