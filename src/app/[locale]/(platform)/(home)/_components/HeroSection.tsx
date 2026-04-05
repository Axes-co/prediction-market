'use client'

import type { Event } from '@/types'
import HeroCarousel from '@/app/[locale]/(platform)/(home)/_components/HeroCarousel'
import HeroSidebar from '@/app/[locale]/(platform)/(home)/_components/HeroSidebar'

interface HeroSectionProps {
  heroEvents: Event[]
}

export default function HeroSection({ heroEvents }: HeroSectionProps) {
  if (heroEvents.length === 0) {
    return null
  }

  return (
    <div className="hidden w-full flex-row items-stretch gap-8 pt-0 lg:flex lg:pt-6 lg:pb-4">
      <HeroCarousel events={heroEvents} />
      <HeroSidebar events={heroEvents} />
    </div>
  )
}
