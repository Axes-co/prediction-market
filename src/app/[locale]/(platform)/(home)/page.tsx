'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { buildPageMetadata } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    title: 'Decentralized Prediction Markets',
    description: 'Trade on real-world events with Axes. Browse live markets, track odds, and make predictions on politics, sports, crypto, and more.',
    path: '/',
    locale: locale as SupportedLocale,
  })
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeContent locale={locale} />
}
