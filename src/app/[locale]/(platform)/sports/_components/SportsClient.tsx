'use client'

import type { SportsVertical } from '@/lib/sports-vertical'
import type { Event } from '@/types'
import { useEffect, useRef } from 'react'
import { useFilters } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import SportsEventsGrid from '@/app/[locale]/(platform)/sports/_components/SportsEventsGrid'

type SportsPageMode = 'all' | 'live' | 'futures'
type SportsSection = 'games' | 'props'

interface SportsClientProps {
  initialEvents: Event[]
  initialTag?: string
  mainTag?: string
  initialMode?: SportsPageMode
  sportsVertical?: SportsVertical | null
  sportsSportSlug?: string | null
  sportsSection?: SportsSection | null
}

export default function SportsClient({
  initialEvents,
  initialTag,
  mainTag,
  initialMode = 'all',
  sportsVertical = null,
  sportsSportSlug = null,
  sportsSection = null,
}: SportsClientProps) {
  const { filters, updateFilters } = useFilters()
  const lastAppliedInitialTagRef = useRef<string | null>(null)
  const effectiveMainTag = mainTag?.trim() || initialTag?.trim() || 'sports'

  useEffect(() => {
    const targetTag = initialTag ?? 'sports'
    if (lastAppliedInitialTagRef.current === targetTag) {
      return
    }

    lastAppliedInitialTagRef.current = targetTag
    updateFilters({ tag: targetTag, mainTag: effectiveMainTag })
  }, [effectiveMainTag, initialTag, updateFilters])

  return (
    <SportsEventsGrid
      eventTag={initialTag ?? 'sports'}
      mainTag={effectiveMainTag}
      filters={filters}
      initialEvents={initialEvents}
      initialMode={initialMode}
      sportsVertical={sportsVertical}
      sportsSportSlug={sportsSportSlug}
      sportsSection={sportsSection}
    />
  )
}
