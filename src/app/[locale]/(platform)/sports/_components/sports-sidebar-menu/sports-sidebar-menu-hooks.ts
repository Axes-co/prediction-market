'use client'

import type { GroupExpansionOverride } from './sports-sidebar-menu-utils'
import type { SportsMenuEntry, SportsMenuLinkEntry } from '@/lib/sports-menu-types'
import type { SportsVertical } from '@/lib/sports-vertical'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  findActiveGroupId,
  isFutureMenuLinkHref,
  isLinkEntry,
  MOBILE_MENU_DEFAULT_VISIBLE_LINKS,
  resolveExpandedGroupId,
  resolveMobileVisiblePrimaryLinkCount,
} from './sports-sidebar-menu-utils'

export function useSidebarEntryDerivations({
  entries,
  vertical,
}: {
  entries: SportsMenuEntry[]
  vertical: SportsVertical
}) {
  const visibleEntries = useMemo(
    () => entries.filter((entry) => {
      return !(
        vertical === 'sports'
        && entry.type === 'link'
        && isFutureMenuLinkHref(entry.href, vertical)
      )
    }),
    [entries, vertical],
  )
  const primaryTopLevelLinks = useMemo(
    () => visibleEntries.filter(isLinkEntry),
    [visibleEntries],
  )
  const allMenuEntries = useMemo(
    () => visibleEntries.flatMap((entry) => {
      if (entry.type === 'link') {
        return [entry]
      }

      if (entry.type === 'group') {
        return [entry, ...entry.links]
      }

      return []
    }),
    [visibleEntries],
  )
  return { visibleEntries, primaryTopLevelLinks, allMenuEntries }
}

export function useSidebarGroupExpansion({
  visibleEntries,
  activeTagSlug,
}: {
  visibleEntries: SportsMenuEntry[]
  activeTagSlug: string | null
}) {
  const [groupExpansionOverride, setGroupExpansionOverride] = useState<GroupExpansionOverride>(null)
  const activeGroupId = useMemo(
    () => findActiveGroupId(visibleEntries, activeTagSlug),
    [activeTagSlug, visibleEntries],
  )
  const expandedGroupId = useMemo(
    () => resolveExpandedGroupId(groupExpansionOverride, activeGroupId, visibleEntries),
    [activeGroupId, groupExpansionOverride, visibleEntries],
  )

  function toggleExpandedGroup(groupId: string) {
    setGroupExpansionOverride((current) => {
      const currentExpandedGroupId = resolveExpandedGroupId(current, activeGroupId, visibleEntries)
      if (currentExpandedGroupId === groupId) {
        return { type: 'none' }
      }
      return { type: 'group', groupId }
    })
  }

  return { expandedGroupId, toggleExpandedGroup, setGroupExpansionOverride }
}

export function useMobileQuickMenuSizing({
  primaryTopLevelLinks,
}: {
  primaryTopLevelLinks: SportsMenuLinkEntry[]
}) {
  const mobileQuickMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false)
  const [mobileVisiblePrimaryLinkCount, setMobileVisiblePrimaryLinkCount] = useState(() => {
    if (typeof window === 'undefined') {
      return MOBILE_MENU_DEFAULT_VISIBLE_LINKS
    }
    return resolveMobileVisiblePrimaryLinkCount(window.innerWidth)
  })

  useEffect(function observeMobileQuickMenuContainerWidth() {
    const container = mobileQuickMenuContainerRef.current
    if (!container) {
      return
    }

    function updateVisibleLinkCount() {
      const nextContainer = mobileQuickMenuContainerRef.current
      if (!nextContainer) {
        return
      }

      const width = nextContainer.clientWidth
      if (width <= 0) {
        return
      }

      const nextCount = resolveMobileVisiblePrimaryLinkCount(width)
      setMobileVisiblePrimaryLinkCount(current => (current === nextCount ? current : nextCount))
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateVisibleLinkCount)
      return function removeMobileQuickMenuResizeListener() {
        window.removeEventListener('resize', updateVisibleLinkCount)
      }
    }

    const resizeObserver = new ResizeObserver(updateVisibleLinkCount)
    resizeObserver.observe(container)

    return function disconnectMobileQuickMenuResizeObserver() {
      resizeObserver.disconnect()
    }
  }, [])

  const mobileVisiblePrimaryLinks = useMemo(
    () => primaryTopLevelLinks.slice(0, mobileVisiblePrimaryLinkCount),
    [primaryTopLevelLinks, mobileVisiblePrimaryLinkCount],
  )

  return {
    mobileQuickMenuContainerRef,
    mobileVisiblePrimaryLinks,
    isMobileMoreMenuOpen,
    setIsMobileMoreMenuOpen,
  }
}
