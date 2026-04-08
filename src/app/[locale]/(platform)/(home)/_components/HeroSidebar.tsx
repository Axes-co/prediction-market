'use client'

import type { Event } from '@/types'
import { useExtracted } from 'next-intl'
import HeroBiggestMovers from '@/app/[locale]/(platform)/(home)/_components/HeroBiggestMovers'
import HeroHotTopics from '@/app/[locale]/(platform)/(home)/_components/HeroHotTopics'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'

interface HeroSidebarProps {
  events: Event[]
}

export default function HeroSidebar({ events }: HeroSidebarProps) {
  const t = useExtracted()

  return (
    <div className="hidden min-h-full w-[40%] flex-col justify-between gap-0 pb-0 lg:flex">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="
          flex max-h-[500px] min-h-[300px] flex-1 flex-col gap-4 overflow-y-auto pb-4 [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
        >
          <HeroBiggestMovers events={events} />
          <div className="border-t border-dashed border-border" />
          <HeroHotTopics events={events} />
          <div className="shrink-0" aria-hidden="true" />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-background"
          aria-hidden="true"
        />
      </div>

      <AppLink href={'/predictions' as never}>
        <Button variant="outline" className="h-10 w-full rounded-full px-8">
          {t('Explore all')}
        </Button>
      </AppLink>
    </div>
  )
}
