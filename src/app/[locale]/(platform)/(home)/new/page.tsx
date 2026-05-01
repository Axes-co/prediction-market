import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'
import { getNewPageSeoTitle } from '@/lib/platform-routing'

const MAIN_TAG_SLUG = 'new' as const

export const metadata: Metadata = {
  title: getNewPageSeoTitle(),
}

// Mirror `(home)/page.tsx` (the trending homepage) — outer page is request-
// bound (`await params`, `setRequestLocale`), inner component carries the
// `'use cache'` directive with a pre-resolved locale. File-level
// `'use cache'` previously wrapped the exported NewPage itself, making
// `await params` execute inside a cached scope, which Next.js 16 cache
// components mode flags as request-bound data inside a cache and times out
// the prerender (USE_CACHE_TIMEOUT, neondatabase/serverless#181).
async function CachedNewPageContent({ locale }: { locale: SupportedLocale }) {
  'use cache'
  return <HomeContent locale={locale} initialTag={MAIN_TAG_SLUG} />
}

export default async function NewPage({ params }: PageProps<'/[locale]/new'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CachedNewPageContent locale={locale as SupportedLocale} />
}
