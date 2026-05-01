import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

// See `(home)/page.tsx` for the rationale on the Suspense wrapper -- the
// events list inside HomeContent triggers `EventRepository.listEvents`
// which exceeds the 50s prerender cache-fill budget under current data
// scale. Suspense lets the shell prerender, data fills at request time.
export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense fallback={null}>
      <HomeContent locale={locale as SupportedLocale} initialTag={MAIN_TAG_SLUG} />
    </Suspense>
  )
}
