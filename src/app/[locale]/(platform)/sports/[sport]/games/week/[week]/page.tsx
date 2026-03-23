'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { mergeUniqueEventsById } from '@/app/[locale]/(platform)/sports/_utils/sports-games-utils'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildPageMetadata } from '@/lib/seo'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string, sport: string, week: string }>
}): Promise<Metadata> {
  const { locale, sport, week } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return buildPageMetadata({
    title: t('Sports Games'),
    description: t('Sports games for the week. Trade on upcoming match outcomes.'),
    path: `/sports/${sport}/games/week/${week}`,
    locale: locale as SupportedLocale,
  })
}

export async function generateStaticParams() {
  return [{
    sport: STATIC_PARAMS_PLACEHOLDER,
    week: STATIC_PARAMS_PLACEHOLDER,
  }]
}

function parseWeekParam(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export default async function SportsGamesBySportWeekPage({
  params,
}: {
  params: Promise<{ locale: string, sport: string, week: string }>
}) {
  const { locale, sport, week } = await params
  setRequestLocale(locale)

  if (sport === STATIC_PARAMS_PLACEHOLDER || week === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  const parsedWeek = parseWeekParam(week)
  if (parsedWeek == null) {
    notFound()
  }

  const [{ data: canonicalSportSlug }, { data: layoutData }] = await Promise.all([
    SportsMenuRepository.resolveCanonicalSlugByAlias(sport),
    SportsMenuRepository.getLayoutData(),
  ])
  if (!canonicalSportSlug) {
    notFound()
  }

  const commonParams = {
    tag: 'sports' as const,
    search: '',
    userId: '',
    bookmarked: false,
    locale: locale as SupportedLocale,
    sportsSportSlug: canonicalSportSlug,
    sportsSection: 'games' as const,
  }

  const [activeResult, resolvedResult] = await Promise.all([
    EventRepository.listEvents({
      ...commonParams,
      status: 'active',
    }),
    EventRepository.listEvents({
      ...commonParams,
      status: 'resolved',
    }),
  ])

  const mergedEvents = mergeUniqueEventsById(activeResult.data ?? [], resolvedResult.data ?? [])
  const cards = buildSportsGamesCards(mergedEvents)
  const sportTitle = layoutData?.h1TitleBySlug[canonicalSportSlug] ?? canonicalSportSlug.toUpperCase()

  return (
    <SportsGamesCenter
      cards={cards}
      sportSlug={canonicalSportSlug}
      sportTitle={sportTitle}
      initialWeek={parsedWeek}
    />
  )
}
