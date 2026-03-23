'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import SportsGamesCenter from '@/app/[locale]/(platform)/sports/_components/SportsGamesCenter'
import { buildSportsGamesCards } from '@/app/[locale]/(platform)/sports/_utils/sports-games-data'
import { EventRepository } from '@/lib/db/queries/event'
import { SportsMenuRepository } from '@/lib/db/queries/sports-menu'
import { buildPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return buildPageMetadata({
    title: t('Sports Live'),
    description: t('Watch and trade on live sports events in real-time.'),
    path: '/sports/live',
    locale: locale as SupportedLocale,
  })
}

export default async function SportsLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [{ data: events }, { data: layoutData }] = await Promise.all([
    EventRepository.listEvents({
      tag: 'sports',
      search: '',
      userId: '',
      bookmarked: false,
      status: 'active',
      locale: locale as SupportedLocale,
      sportsSection: 'games',
    }),
    SportsMenuRepository.getLayoutData(),
  ])
  const cards = buildSportsGamesCards(events ?? [])

  return (
    <SportsGamesCenter
      cards={cards}
      sportSlug="live"
      sportTitle="LIVE"
      pageMode="live"
      categoryTitleBySlug={layoutData?.h1TitleBySlug ?? {}}
    />
  )
}
