'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import LeaderboardClient from '@/app/[locale]/(platform)/leaderboard/_components/LeaderboardClient'
import { CATEGORY_OPTIONS, ORDER_OPTIONS, parseLeaderboardFilters, PERIOD_OPTIONS } from '@/app/[locale]/(platform)/leaderboard/_utils/leaderboardFilters'
import { buildPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]/leaderboard/[[...filters]]'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()

  return buildPageMetadata({
    title: t('Leaderboard'),
    description: t('See the top traders on Axes. Track profit and loss rankings across all prediction markets.'),
    path: '/leaderboard',
    locale: locale as SupportedLocale,
  })
}

export async function generateStaticParams() {
  const params: Array<{ filters: string[] }> = [{ filters: [] }]

  for (const category of CATEGORY_OPTIONS.map(option => option.value)) {
    for (const period of PERIOD_OPTIONS.map(option => option.value)) {
      for (const order of ORDER_OPTIONS.map(option => option.value)) {
        params.push({ filters: [category, period, order] })
      }
    }
  }

  return params
}

export default async function LeaderboardPage({ params }: PageProps<'/[locale]/leaderboard/[[...filters]]'>) {
  const { locale, filters } = await params
  setRequestLocale(locale)

  const initialFilters = parseLeaderboardFilters(filters)

  return (
    <main className="container w-full py-6 md:py-8">
      <LeaderboardClient initialFilters={initialFilters} />
    </main>
  )
}
