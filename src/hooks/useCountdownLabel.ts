'use client'

import { useMemo } from 'react'
import { useCurrentTimestamp } from '@/hooks/useCurrentTimestamp'

/**
 * Returns a formatted countdown label from the current time to `endDate`.
 * Ticks every second via `useCurrentTimestamp`.
 *
 * Format tiers (matching EventLiveSeriesChart countdown logic):
 *  - > 24h: "2d 5h"
 *  - > 1h:  "3h 12m"
 *  - ≤ 1h:  "4m 32s"
 *  - expired or no date: null
 */
export function useCountdownLabel(endDate: string | null | undefined): string | null {
  const nowMs = useCurrentTimestamp({ intervalMs: 1000 })

  return useMemo(() => {
    if (!endDate || nowMs == null) {
      return null
    }

    const endMs = new Date(endDate).getTime()
    if (Number.isNaN(endMs)) {
      return null
    }

    const totalSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000))
    if (totalSeconds <= 0) {
      return null
    }

    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (days > 0) {
      return `${days}d ${hours}h`
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }

    return `${minutes}m ${seconds}s`
  }, [endDate, nowMs])
}
