'use client'

import type { Event } from '@/types'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@/lib/utils'

interface HeroCarouselControlsProps {
  totalSlides: number
  activeIndex: number
  progress: number
  events: Event[]
  onGoTo: (index: number) => void
  onPrev: () => void
  onNext: () => void
}

function resolveAdjacentTitle(events: Event[], activeIndex: number, direction: 'prev' | 'next') {
  const total = events.length
  if (total <= 1) {
    return ''
  }
  const targetIndex = direction === 'next'
    ? (activeIndex + 1) % total
    : (activeIndex - 1 + total) % total
  return events[targetIndex]?.title ?? ''
}

export default memo(({
  totalSlides,
  activeIndex,
  progress,
  events,
  onGoTo,
  onPrev,
  onNext,
}: HeroCarouselControlsProps) => {
  if (totalSlides <= 1) {
    return null
  }

  const prevTitle = resolveAdjacentTitle(events, activeIndex, 'prev')
  const nextTitle = resolveAdjacentTitle(events, activeIndex, 'next')

  return (
    <div className="flex items-center justify-center pr-0 pl-5 md:h-10 md:justify-between">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSlides }).map((_, index) => {
          const isActive = index === activeIndex
          return (
            <button
              key={index}
              type="button"
              onClick={() => onGoTo(index)}
              className={cn(
                'relative overflow-hidden rounded-full transition-all duration-300',
                isActive
                  ? 'h-1.5 w-8 bg-muted'
                  : 'size-1.5 cursor-pointer bg-muted hover:bg-muted-foreground/50',
              )}
              aria-label={`Go to slide ${index + 1}`}
            >
              {isActive && (
                <div
                  className="absolute top-0 left-0 size-full origin-left rounded-full bg-foreground"
                  style={{ transform: `scaleX(${progress})`, transition: 'none' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Prev / Next pill buttons */}
      <div className="hidden items-center lg:flex">
        <button
          type="button"
          onClick={onPrev}
          className="group flex cursor-pointer items-center py-2 pr-1.5 pl-2 outline-none"
          aria-label="Previous slide"
        >
          <div className="
            relative flex h-10 items-center justify-center overflow-hidden rounded-full border-none bg-muted/50 px-3
            transition-transform
            group-active:scale-[0.98]
            hover:bg-muted
          "
          >
            <ChevronLeftIcon className="size-3 shrink-0 text-muted-foreground" />
            <span className="max-w-[120px] truncate p-2 text-sm font-medium whitespace-nowrap text-muted-foreground">
              {prevTitle}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="group flex cursor-pointer items-center py-2 pr-2 pl-1.5 outline-none"
          aria-label="Next slide"
        >
          <div className="
            relative flex h-10 items-center justify-center overflow-hidden rounded-full border-none bg-muted/50 px-3
            transition-transform
            group-active:scale-[0.98]
            hover:bg-muted
          "
          >
            <span className="max-w-[120px] truncate p-2 text-sm font-medium whitespace-nowrap text-muted-foreground">
              {nextTitle}
            </span>
            <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
          </div>
        </button>
      </div>
    </div>
  )
})
