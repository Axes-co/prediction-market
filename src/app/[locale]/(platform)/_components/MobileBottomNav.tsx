'use client'

import type { LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import { ActivityIcon, HomeIcon, SearchIcon, WalletIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'
import MobileSearchOverlay from '@/app/[locale]/(platform)/_components/MobileSearchOverlay'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface NavTabBase {
  key: string
  icon: LucideIcon
  label: string
}

interface NavLinkTab extends NavTabBase {
  type: 'link'
  path: string
}

interface NavActionTab extends NavTabBase {
  type: 'action'
  onPress: () => void
  isActive: boolean
}

type NavTab = NavLinkTab | NavActionTab

const TAB_CLASS = 'flex flex-1 flex-col items-center justify-center gap-1 transition-colors'
const ACTIVE_STROKE_WIDTH = 2.5
const DEFAULT_STROKE_WIDTH = 2

function useRouteMatch(linkTabs: NavLinkTab[]) {
  const pathname = usePathname()

  return useCallback((path: string) => {
    if (path === '/') {
      const matchesOtherTab = linkTabs.some(
        tab => tab.path !== '/' && pathname.startsWith(tab.path),
      )
      return !matchesOtherTab
    }
    return pathname.startsWith(path)
  }, [pathname, linkTabs])
}

function NavTabItem({ tab, isActive }: { tab: NavTab, isActive: boolean }) {
  const strokeWidth = isActive ? ACTIVE_STROKE_WIDTH : DEFAULT_STROKE_WIDTH
  const colorClass = isActive ? 'text-foreground' : 'text-muted-foreground'

  if (tab.type === 'action') {
    return (
      <button
        type="button"
        onClick={tab.onPress}
        className={cn(TAB_CLASS, colorClass)}
      >
        <tab.icon className="size-5" strokeWidth={strokeWidth} />
        <span className="text-2xs font-medium">{tab.label}</span>
      </button>
    )
  }

  return (
    <IntentPrefetchLink
      href={tab.path as Route}
      className={cn(TAB_CLASS, colorClass)}
    >
      <tab.icon className="size-5" strokeWidth={strokeWidth} />
      <span className="text-2xs font-medium">{tab.label}</span>
    </IntentPrefetchLink>
  )
}

export default function MobileBottomNav() {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  const linkTabs = useMemo<NavLinkTab[]>(() => [
    { key: 'markets', type: 'link', path: '/', icon: HomeIcon, label: t('Markets') },
    { key: 'activity', type: 'link', path: '/activity', icon: ActivityIcon, label: t('Activity') },
    { key: 'portfolio', type: 'link', path: '/portfolio', icon: WalletIcon, label: t('Portfolio') },
  ], [t])

  const isRouteActive = useRouteMatch(linkTabs)

  const tabs = useMemo<NavTab[]>(() => [
    linkTabs[0],
    { key: 'search', type: 'action', icon: SearchIcon, label: t('Search'), onPress: openSearch, isActive: searchOpen },
    linkTabs[1],
    linkTabs[2],
  ], [linkTabs, t, openSearch, searchOpen])

  if (!isMobile) {
    return null
  }

  return (
    <>
      <MobileSearchOverlay open={searchOpen} onClose={closeSearch} />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4 pb-[env(safe-area-inset-bottom)]">
          {tabs.map(tab => (
            <NavTabItem
              key={tab.key}
              tab={tab}
              isActive={tab.type === 'action' ? tab.isActive : isRouteActive(tab.path)}
            />
          ))}
        </div>
      </nav>
    </>
  )
}
