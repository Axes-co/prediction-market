'use client'

import type { Event } from '@/types'
import { useCallback, useRef } from 'react'
import HeroCarouselControls from '@/app/[locale]/(platform)/(home)/_components/HeroCarouselControls'
import HeroCarouselSlide from '@/app/[locale]/(platform)/(home)/_components/HeroCarouselSlide'
import { useCarouselAutoAdvance } from '@/app/[locale]/(platform)/(home)/_hooks/useCarouselAutoAdvance'

interface HeroCarouselProps {
  events: Event[]
}

const AUTO_ADVANCE_INTERVAL_MS = 10_000

export default function HeroCarousel({ events }: HeroCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    activeIndex,
    progress,
    goTo,
    next,
    prev,
    pause,
    resume,
  } = useCarouselAutoAdvance({
    totalSlides: events.length,
    intervalMs: AUTO_ADVANCE_INTERVAL_MS,
    enabled: events.length > 1,
  })

  const handleMouseEnter = useCallback(() => pause(), [pause])
  const handleMouseLeave = useCallback(() => resume(), [resume])
  const handleFocusIn = useCallback(() => pause(), [pause])
  const handleFocusOut = useCallback((e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      resume()
    }
  }, [resume])

  if (events.length === 0) {
    return null
  }

  return (
    <section
      ref={containerRef}
      className="group/carousel hidden w-full flex-col gap-4 lg:flex"
      aria-label="Featured markets carousel"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
    >
      <div className="
        h-fit overflow-hidden rounded-[18px] border border-primary/10 bg-card shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]
        shadow-primary/7
        lg:relative lg:h-auto lg:max-h-[500px] lg:min-h-[min(480px,60vh)] lg:flex-1
        dark:border-border dark:shadow-none
      "
      >
        <div className="absolute inset-0 overflow-hidden">
          {events.map((event, index) => {
            const offset = (index - activeIndex) * 100
            return (
              <div
                key={event.id}
                className="absolute inset-0 p-5 pb-4"
                aria-hidden={index !== activeIndex}
                style={{
                  transform: `translateX(${offset}%)`,
                  transition: 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                <HeroCarouselSlide event={event} isActive={index === activeIndex} />
              </div>
            )
          })}
        </div>
      </div>

      <HeroCarouselControls
        totalSlides={events.length}
        activeIndex={activeIndex}
        progress={progress}
        events={events}
        onGoTo={goTo}
        onPrev={prev}
        onNext={next}
      />
    </section>
  )
}
