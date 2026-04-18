import type { LiveSeriesPriceSnapshot, PersistedLivePrice } from '../_utils/eventLiveSeriesChartUtils'
import type { EventLiveChartConfig } from '@/types'
import { useEffect, useState } from 'react'
import {
  LIVE_DATA_RETENTION_MS,

  normalizeLiveChartPrice,

  writePersistedLivePrice,
} from '../_utils/eventLiveSeriesChartUtils'

interface UseLiveSeriesPriceSnapshotOptions {
  config: EventLiveChartConfig
  subscriptionSymbol: string
  explicitEndTimestamp: number | null
  startTimestamp: number | null
}

export interface LiveSeriesPriceSnapshotResult {
  referenceSnapshot: LiveSeriesPriceSnapshot | null
  baselinePrice: number | null
  setBaselinePrice: React.Dispatch<React.SetStateAction<number | null>>
  persistedFallbackPrice: PersistedLivePrice | null
}

export function useLiveSeriesPriceSnapshot({
  config,
  subscriptionSymbol,
  explicitEndTimestamp,
  startTimestamp,
}: UseLiveSeriesPriceSnapshotOptions): LiveSeriesPriceSnapshotResult {
  const [referenceSnapshot, setReferenceSnapshot] = useState<LiveSeriesPriceSnapshot | null>(null)
  const [baselinePrice, setBaselinePrice] = useState<number | null>(null)
  const [persistedFallbackPrice, setPersistedFallbackPrice] = useState<PersistedLivePrice | null>(null)

  useEffect(function fetchLiveSeriesPriceSnapshot() {
    const seriesSlug = config.series_slug?.trim()
    if (!seriesSlug) {
      return
    }

    const snapshotEventEndMs = explicitEndTimestamp ?? Date.now()
    if (!Number.isFinite(snapshotEventEndMs) || snapshotEventEndMs <= 0) {
      return
    }

    const controller = new AbortController()
    let isCancelled = false

    async function loadPriceSnapshot() {
      try {
        const query = new URLSearchParams({
          seriesSlug,
          eventEndMs: String(snapshotEventEndMs),
          activeWindowMinutes: String(config.active_window_minutes),
        })
        if (startTimestamp != null && startTimestamp > 0 && startTimestamp < snapshotEventEndMs) {
          query.set('eventStartMs', String(startTimestamp))
        }

        const response = await fetch(`/api/price-reference/live-series?${query.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json() as LiveSeriesPriceSnapshot
        if (isCancelled) {
          return
        }

        setReferenceSnapshot(payload)

        if (typeof payload.opening_price === 'number' && Number.isFinite(payload.opening_price) && payload.opening_price > 0) {
          setBaselinePrice(payload.opening_price)
        }

        const fallbackPrice = normalizeLiveChartPrice(
          payload.latest_price ?? payload.closing_price ?? Number.NaN,
          config.topic,
        )

        if (typeof fallbackPrice === 'number') {
          const rawFallbackTimestamp = payload.latest_source_timestamp_ms ?? payload.event_window_end_ms ?? Date.now()
          const minTimestamp = Date.now() - LIVE_DATA_RETENTION_MS + 1000
          const fallbackTimestamp = Math.max(rawFallbackTimestamp, minTimestamp)
          writePersistedLivePrice(config.topic, subscriptionSymbol, fallbackPrice, fallbackTimestamp)
          setPersistedFallbackPrice({
            price: fallbackPrice,
            timestamp: fallbackTimestamp,
          })
        }
      }
      catch {
      }
    }

    loadPriceSnapshot()

    return function cleanupLiveSeriesPriceSnapshot() {
      isCancelled = true
      controller.abort()
    }
  }, [config.active_window_minutes, config.series_slug, config.topic, explicitEndTimestamp, startTimestamp, subscriptionSymbol])

  return {
    referenceSnapshot,
    baselinePrice,
    setBaselinePrice,
    persistedFallbackPrice,
  }
}
