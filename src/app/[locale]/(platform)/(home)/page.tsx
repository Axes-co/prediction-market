'use cache'

import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { buildPageMetadata } from '@/lib/seo'
import { loadRuntimeThemeState } from '@/lib/theme-settings'

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getExtracted()
  const { site } = await loadRuntimeThemeState()

  return buildPageMetadata({
    title: site.description,
    description: t('Trade on real-world events. Browse live markets, track odds, and make predictions on politics, sports, crypto, and more.'),
    path: '/',
    locale: locale as SupportedLocale,
    siteName: site.name,
  })
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeContent locale={locale} />
}
