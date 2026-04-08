'use client'

import type { HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import { useExtracted } from 'next-intl'
import Image from 'next/image'
import { useMemo } from 'react'
import LiveIndicator from '@/components/LiveIndicator'
import { formatDate } from '@/lib/formatters'
import { parseSportsScore } from '@/lib/sports-resolution'

interface SportsScoreboardProps {
  event: Event
  model: HomeSportsMoneylineModel
}

export default function SportsScoreboard({ event, model }: SportsScoreboardProps) {
  const t = useExtracted()
  const score = useMemo(() => parseSportsScore(event.sports_score), [event.sports_score])
  const isLive = Boolean(event.sports_live)
  const isEnded = Boolean(event.sports_ended)

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

  // For scheduled (pre-game) events, show the start time
  const scheduledLabel = useMemo(() => {
    if (isLive || isEnded) {
      return null
    }
    const rawDate = event.sports_start_time ?? event.start_date
    if (!rawDate) {
      return t('Scheduled')
    }
    const d = new Date(rawDate)
    return Number.isNaN(d.getTime()) ? t('Scheduled') : formatDate(d)
  }, [isLive, isEnded, event.sports_start_time, event.start_date, t])

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end justify-center gap-10">
        {/* Team 1 */}
        <TeamColumn team={model.team1} />

        {/* Score center */}
        <div className="flex w-[140px] flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
              <div className="flex flex-col items-end gap-1">
                <span className="text-2xl/tight font-semibold tabular-nums">
                  {score?.team1 ?? 0}
                </span>
              </div>
              <span className="mb-5 h-1 w-3 rounded-full bg-muted-foreground/30" />
              <div className="flex flex-col items-start gap-1">
                <span className="text-2xl/tight font-semibold tabular-nums">
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

            {scheduledLabel && (
              <div className="mb-0.5 text-sm font-medium text-muted-foreground">
                {scheduledLabel}
              </div>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <TeamColumn team={model.team2} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team column (logo + abbreviation)
// ---------------------------------------------------------------------------

function TeamColumn({ team }: { team: HomeSportsMoneylineModel['team1'] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
      <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-md">
        {team.logoUrl
          ? (
              <Image
                src={team.logoUrl}
                alt={team.abbreviation}
                fill
                sizes="48px"
                className="object-contain"
              />
            )
          : (
              <span className="text-lg font-bold text-muted-foreground">{team.abbreviation}</span>
            )}
      </div>
      <span className="block w-full text-center text-base font-medium break-normal text-foreground">
        {team.abbreviation}
      </span>
    </div>
  )
}
