import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Footer from '@/app/[locale]/(platform)/_components/Footer'
import Header from '@/app/[locale]/(platform)/_components/Header'
import MobileBottomNav from '@/app/[locale]/(platform)/_components/MobileBottomNav'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import PlatformNavigationProvider from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { loadPlatformMainTags } from '@/lib/platform-main-tags'
import { buildChildParentMap, buildPlatformNavigationTags } from '@/lib/platform-navigation'
import AppKitProvider from '@/providers/AppKitProvider'

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  const t = await getExtracted()
  const { data: mainTags, globalChilds = [] } = await loadPlatformMainTags(resolvedLocale)
  const tags = buildPlatformNavigationTags({
    mainTags: mainTags ?? [],
    globalChilds,
    trendingLabel: t('Trending'),
    newLabel: t('New'),
  })
  const childParentMap = buildChildParentMap(mainTags ?? [])

  return (
    <AppKitProvider>
      <PlatformViewerState />
      <FilterProvider>
        <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
          <Header />
          <NavigationTabs />
          {children}
          <CachedFooter />
          <MobileBottomNav />
          <AffiliateQueryHandler />
        </PlatformNavigationProvider>
      </FilterProvider>
    </AppKitProvider>
  )
}

// Wraps `<Footer year={...}/>` so `new Date()` resolves at build time inside
// a `'use cache'` scope, per Next.js 16 cache-components rules: outside a
// cache scope the prerender refuses non-deterministic calls (`new Date()`,
// `Math.random()`) unless preceded by uncached/request data access; inside
// a cache scope they are allowed and execute once. The CLAUDE.md customization
// keeping `year={new Date().getFullYear()}` is preserved.
async function CachedFooter() {
  'use cache'
  return <Footer year={new Date().getFullYear()} />
}
