'use client'

import type { Event } from '@/types'
import { LinkIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import AppLink from '@/components/AppLink'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { resolveEventPagePath } from '@/lib/events-routing'
import { formatSportsDisplayLabel, resolveSportsCompetitionLabel } from '@/lib/sports-labels'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Actions: copy link + bookmark
// ---------------------------------------------------------------------------

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
// Header content: title, breadcrumbs, icon, actions
// ---------------------------------------------------------------------------

interface SlideHeaderProps {
  event: Event
  compact?: boolean
  isSportsLayout?: boolean
  hideIcon?: boolean
}

export default function SlideHeader({ event, compact, isSportsLayout, hideIcon }: SlideHeaderProps) {
  const eventPath = resolveEventPagePath(event)
  const isSportsEvent = Boolean(isSportsLayout)

  const sportLabel = isSportsEvent ? formatSportsDisplayLabel(event.sports_sport_slug) : null
  const competitionLabel = isSportsEvent ? resolveSportsCompetitionLabel(event) : null

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
        {event.icon_url && !hideIcon && (
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
                        text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors
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
