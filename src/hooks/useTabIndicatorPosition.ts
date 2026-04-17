'use client'

import { useLayoutEffect, useRef, useState } from 'react'

interface UseTabIndicatorPositionOptions<T extends { id: string }> {
  tabs: T[]
  activeTab: string
}

export function useTabIndicatorPosition<T extends { id: string }>({
  tabs,
  activeTab,
}: UseTabIndicatorPositionOptions<T>) {
  const tabRef = useRef<(HTMLButtonElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  useLayoutEffect(function positionActiveTabIndicator() {
    const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab)
    const activeTabElement = tabRef.current[activeTabIndex]

    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement

      queueMicrotask(() => {
        setIndicatorStyle(prev => ({
          ...prev,
          left: offsetLeft,
          width: offsetWidth,
        }))

        setIsInitialized(prev => prev || true)
      })
    }
  }, [activeTab, tabs])

  return { tabRef, indicatorStyle, isInitialized }
}
