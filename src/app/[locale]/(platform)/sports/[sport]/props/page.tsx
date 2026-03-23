'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsContent from '@/app/[locale]/(platform)/sports/_components/SportsContent'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildPageMetadata } from '@/lib/seo'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sport: string }>
}): Promise<Metadata> {
  const { locale, sport } = await params
  return buildPageMetadata({
    title: 'Sports Props',
    description: 'Browse player props and individual performance predictions for sports events.',
    path: `/sports/${sport}/props`,
    locale: locale as SupportedLocale,
  })
}

export async function generateStaticParams() {
  return [{ sport: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function SportsPropsBySportPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string }>
}) {
  const { locale, sport } = await params
  setRequestLocale(locale)
  if (sport === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const { data: canonicalSportSlug } = await SportsMenuRepository.resolveCanonicalSlugByAlias(sport)
  if (!canonicalSportSlug) {
    notFound()
  }

  return (
    <div className="grid gap-4">
      <SportsContent
        locale={locale}
        initialTag="sports"
        initialMode="all"
        sportsSportSlug={canonicalSportSlug}
        sportsSection="props"
      />
    </div>
  )
}
