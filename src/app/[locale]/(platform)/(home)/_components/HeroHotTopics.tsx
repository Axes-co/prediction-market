'use client'

import type { Event } from '@/types'
import { ChevronRightIcon, FlameIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import AppLink from '@/components/AppLink'
import { formatCompactCurrency } from '@/lib/formatters'

interface HeroHotTopicsProps {
  events: Event[]
}

interface TopicEntry {
  name: string
  slug: string
  volume: number
}

function aggregateTopics(events: Event[]): TopicEntry[] {
  const topicMap = new Map<string, TopicEntry>()

  for (const event of events) {
    for (const tag of event.tags) {
      if (!tag.isMainCategory) {
        continue
      }

      const existing = topicMap.get(tag.slug)
      if (existing) {
        existing.volume += event.volume
      }
      else {
        topicMap.set(tag.slug, {
          name: tag.name,
          slug: tag.slug,
          volume: event.volume,
        })
      }
    }
  }

  return Array.from(topicMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5)
}

export default function HeroHotTopics({ events }: HeroHotTopicsProps) {
  const t = useExtracted()
  const topics = useMemo(() => aggregateTopics(events), [events])

  if (topics.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg">
      <AppLink href={'/predictions?_sort=volume' as never} className="group flex items-center gap-1 hover:underline">
        <h2 className="text-lg font-semibold text-foreground">{t('Hot topics')}</h2>
        <ChevronRightIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </AppLink>

      <div className="flex flex-col">
        {topics.map((topic, index) => (
          <AppLink
            key={topic.slug}
            href={`/predictions/${topic.slug}` as never}
            className="group flex items-start gap-4 py-2.5"
          >
            <div className="text-sm font-semibold text-muted-foreground tabular-nums">
              {index + 1}
            </div>
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex flex-1 items-center justify-between gap-1.5">
                <div className="text-sm font-medium text-foreground group-hover:underline">
                  {topic.name}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">{t('{amount} today', { amount: formatCompactCurrency(topic.volume) })}</span>
                  <FlameIcon className="size-3.5 text-destructive" />
                </div>
              </div>
              <ChevronRightIcon className="size-3 text-muted-foreground" />
            </div>
          </AppLink>
        ))}
      </div>
    </div>
  )
}
