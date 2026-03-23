'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import ActivityFeed from '@/app/[locale]/(platform)/activity/_components/ActivityFeed'
import { buildHreflangAlternates } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]/activity'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getExtracted()

  return {
    title: t('Activity'),
    alternates: buildHreflangAlternates('/activity', locale as SupportedLocale),
  }
}

export default async function ActivityPage({ params }: PageProps<'/[locale]/activity'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="container py-6 md:py-8">
      <ActivityFeed />
    </main>
  )
}
