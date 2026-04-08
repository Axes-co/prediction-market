'use client'

import type { SlideLayout } from '@/app/[locale]/(platform)/(home)/_components/HeroCarouselSlide'
import type { Event } from '@/types'
import { RepeatIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import LiveIndicator from '@/components/LiveIndicator'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { formatDate, formatVolume } from '@/lib/formatters'

interface SlideFooterProps {
  event: Event
  layout: SlideLayout
}

export default function SlideFooter({ event, layout }: SlideFooterProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const isLive = Boolean(event.sports_live) || layout === 'live-chart'
  const hasRecurrence = Boolean(event.series_recurrence)

  const endDateLabel = layout === 'standard' && event.end_date
    ? (() => {
        const d = new Date(event.end_date)
        return Number.isNaN(d.getTime()) ? null : t('Ends {date}', { date: formatDate(d) })
      })()
    : null

  const recurrenceLabel = hasRecurrence
    ? event.series_recurrence!.charAt(0).toUpperCase() + event.series_recurrence!.slice(1).toLowerCase()
    : null

  const hasRightContent = isLive || endDateLabel || recurrenceLabel

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
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
