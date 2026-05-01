import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'

// Wrap `<HomeContent>` in `<Suspense>` so the static shell (header, nav,
// layout chrome) can prerender at build time while the events list fills
// at request time. Without this boundary, prerender awaits the entire
// `loadHomeEventCandidates` -> `EventRepository.listEvents` chain inside a
// 50s budget; under today's row counts (~1.7k events / 25k markets) that
// budget is regularly exceeded and the build errors with USE_CACHE_TIMEOUT
// at `event.ts:1485`. The data layer's `'use cache'` boundaries still cache
// per-request results; only the prerender-time fill is deferred.
//
// Per Next.js docs (use-cache directive): "If this data should be accessed
// on every user request you must provide a fallback UI using Suspense from
// React." That is exactly the trade we want here -- the events list is
// volume-driven and hot-recached on every gamma sync via cacheTags.eventsList,
// so per-request render is correct.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense fallback={null}>
      <HomeContent locale={locale as SupportedLocale} />
    </Suspense>
  )
}
