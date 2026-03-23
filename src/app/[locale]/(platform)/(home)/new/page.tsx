'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'
import { buildPageMetadata } from '@/lib/seo'

const MAIN_TAG_SLUG = 'new' as const

export async function generateMetadata({ params }: PageProps<'/[locale]/new'>): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: getNewPageSeoTitle(),
    description: 'Discover the newest prediction markets on Axes. Be the first to trade on trending topics and emerging events.',
    path: '/new',
    locale: locale as SupportedLocale,
  })
}

export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent locale={locale} initialTag={MAIN_TAG_SLUG} />
}
