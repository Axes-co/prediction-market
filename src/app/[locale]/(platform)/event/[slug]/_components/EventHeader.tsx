import type { Event } from '@/types'
import { useEffect, useState } from 'react'
import EventBookmark from '@/app/[locale]/(platform)/event/[slug]/_components/EventBookmark'
import EventEmbedWidget from '@/app/[locale]/(platform)/event/[slug]/_components/EventEmbedWidget'
import EventShare from '@/app/[locale]/(platform)/event/[slug]/_components/EventShare'
import EventIconImage from '@/components/EventIconImage'
import { cn } from '@/lib/utils'

interface EventHeaderProps {
  event: Event
}

export default function EventHeader({ event }: EventHeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={cn(
        'relative z-10 -mx-4 flex items-center gap-3 px-4 transition-all ease-in-out',
        { 'sticky top-26 translate-y-1 bg-background py-3 pr-6 md:translate-y-3 lg:top-28 lg:translate-y-1': scrolled },
      )}
    >
      {scrolled && (
        <span className="pointer-events-none absolute inset-x-4 bottom-0 border-b" />
      )}
      <div className="relative z-10 flex flex-1 items-center gap-2 lg:gap-4">
        <div
          className={cn(
            'shrink-0 rounded-sm transition-all ease-in-out dark:bg-foreground',
            scrolled ? 'size-10' : 'size-10 lg:size-16',
          )}
        >
          <EventIconImage
            src={event.icon_url}
            alt={event.creator || 'Market creator'}
            sizes={scrolled ? '40px' : '(min-width: 1024px) 64px, 40px'}
            containerClassName="size-full rounded-sm"
          />
        </div>

        <h1 className={cn(
          'leading-tight! font-semibold transition-all ease-in-out',
          scrolled ? 'text-sm lg:text-base' : 'text-xl lg:text-2xl',
        )}
        >
          {event.title}
        </h1>
      </div>

      <div className="flex items-center gap-3 text-foreground">
        <EventShare event={event} />
        <EventBookmark event={event} />
        <EventEmbedWidget event={event} />
      </div>
    </div>
  )
}
