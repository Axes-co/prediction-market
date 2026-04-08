'use client'

import type { Event } from '@/types'
import { memo, useCallback, useMemo, useRef } from 'react'
import HeroCarouselSlideChart from '@/app/[locale]/(platform)/(home)/_components/HeroCarouselSlideChart'
import HeroLiveChartPanel from '@/app/[locale]/(platform)/(home)/_components/HeroLiveChartPanel'
import SlideCommentMarquee from '@/app/[locale]/(platform)/(home)/_components/SlideCommentMarquee'
import SlideFooter from '@/app/[locale]/(platform)/(home)/_components/SlideFooter'
import SlideHeader from '@/app/[locale]/(platform)/(home)/_components/SlideHeader'
import SlideOutcomes from '@/app/[locale]/(platform)/(home)/_components/SlideOutcomes'
import SportsMoneylineButtons from '@/app/[locale]/(platform)/(home)/_components/SportsMoneylineButtons'
import SportsScoreboard from '@/app/[locale]/(platform)/(home)/_components/SportsScoreboard'
import AppLink from '@/components/AppLink'
import { resolveEventPagePath } from '@/lib/events-routing'
import { isHomeEventResolvedLike } from '@/lib/home-events'
import { buildChanceByMarket } from '@/lib/market-chance'
import { buildHomeSportsMoneylineModel } from '@/lib/sports-home-card'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlideLayout = 'sports' | 'live-chart' | 'standard'

interface HeroCarouselSlideProps {
  event: Event
  isActive: boolean
  shouldPreload?: boolean
}

// ---------------------------------------------------------------------------
// Layout resolution
// ---------------------------------------------------------------------------

const HERO_SPORTS_BUTTON_HEIGHT = 'h-14'

function resolveSlideLayout(
  event: Event,
  hasSportsModel: boolean,
): SlideLayout {
  if (hasSportsModel) {
    return 'sports'
  }
  if (event.has_live_chart && !isHomeEventResolvedLike(event)) {
    return 'live-chart'
  }
  return 'standard'
}

// ---------------------------------------------------------------------------
// Main slide component
// ---------------------------------------------------------------------------

function HeroCarouselSlide({ event, isActive, shouldPreload }: HeroCarouselSlideProps) {
  // Lazy-load: mount data-fetching children once the slide has been active
  // OR is adjacent to the active slide (preload). Prevents all slides from
  // hitting APIs simultaneously on page load while ensuring smooth transitions.
  const hasBeenActiveRef = useRef(false)
  if (isActive || shouldPreload) {
    hasBeenActiveRef.current = true
  }
  const shouldRenderContent = hasBeenActiveRef.current

  const homeSportsMoneylineModel = useMemo(() => buildHomeSportsMoneylineModel(event), [event])
  const chanceByMarket = useMemo(() => buildChanceByMarket(event.markets), [event.markets])
  const getDisplayChance = useCallback((marketId: string) => chanceByMarket[marketId] ?? 0, [chanceByMarket])

  const layout = useMemo(() => resolveSlideLayout(event, homeSportsMoneylineModel !== null), [event, homeSportsMoneylineModel])
  const useCompactHeader = layout !== 'standard'

  return (
    <div className={cn('relative flex size-full flex-col', useCompactHeader ? 'gap-2' : 'gap-4')}>
      {/* Full-bleed click target */}
      <AppLink href={resolveEventPagePath(event) as never} className="absolute inset-0" aria-hidden="true" tabIndex={-1} />

      {/* Standard header — multi-market events only */}
      {!useCompactHeader && <SlideHeader event={event} />}

      {/* Mobile compact header for sports/live-chart */}
      {useCompactHeader && (
        <div className="lg:hidden">
          <SlideHeader event={event} compact isSportsLayout={layout === 'sports'} hideIcon={layout === 'sports'} />
        </div>
      )}

      {/* Body: left panel + right panel */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-4 lg:flex-row lg:gap-6">
        {/* LEFT 40% */}
        <div className="relative flex flex-col gap-4 lg:w-[40%] lg:justify-between">
          {useCompactHeader && (
            <div className="hidden lg:block">
              <SlideHeader event={event} compact isSportsLayout={layout === 'sports'} hideIcon={layout === 'sports'} />
            </div>
          )}

          {homeSportsMoneylineModel
            ? <SportsMoneylineButtons event={event} model={homeSportsMoneylineModel} heightClass={HERO_SPORTS_BUTTON_HEIGHT} />
            : <SlideOutcomes event={event} getDisplayChance={getDisplayChance} />}

          {/* Comment marquee — lazy-loaded */}
          <div className="hidden min-h-0 flex-1 overflow-hidden lg:flex">
            {shouldRenderContent && <SlideCommentMarquee event={event} />}
          </div>
        </div>

        {/* RIGHT 60% — chart rendering per layout type (lazy-loaded) */}
        <div className="relative hidden h-full min-h-0 flex-1 flex-col justify-center lg:flex">
          {shouldRenderContent && (
            layout === 'sports' && homeSportsMoneylineModel
              ? (
                  <>
                    <SportsScoreboard event={event} model={homeSportsMoneylineModel} />
                    <div className="hidden min-h-0 flex-1 pt-2 lg:block">
                      <HeroCarouselSlideChart event={event} variant="sports" sportsModel={homeSportsMoneylineModel} />
                    </div>
                  </>
                )
              : layout === 'live-chart'
                ? (
                    <HeroLiveChartPanel event={event} isActive={isActive} />
                  )
                : (
                    <div className="min-h-0 flex-1">
                      <HeroCarouselSlideChart event={event} variant="multi-outcome" />
                    </div>
                  )
          )}
        </div>
      </div>

      <SlideFooter event={event} layout={layout} />
    </div>
  )
}

export default memo(HeroCarouselSlide)
