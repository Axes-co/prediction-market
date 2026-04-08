'use client'

import type { LiveSeriesPriceSnapshot } from '@/lib/live-chart'
import type { Event, EventLiveChartConfig } from '@/types'
import type { DataPoint } from '@/types/PredictionChartTypes'
import { useEffect, useMemo, useState } from 'react'
import {
  extractLivePriceUpdates,
  isSnapshotMessage,
  normalizeLiveChartPrice,
  normalizeSubscriptionSymbol,
  parseUtcDate,
  resolveEventEndTimestamp,
} from '@/lib/live-chart'
import { createWebSocketReconnectController } from '@/lib/websocket-reconnect'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERIES_KEY = 'live_price'
const LIVE_WINDOW_MS = 40_000
const LIVE_DATA_RETENTION_MS = LIVE_WINDOW_MS + 8_000
const MAX_POINTS = 4000
const CLOCK_INTERVAL_MS = 100
const USE_ONLY_LAST_UPDATE_PER_MESSAGE = true

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveChartStreamState {
  config: EventLiveChartConfig | null
  baselinePrice: number | null
  currentPrice: number | null
  liveData: DataPoint[]
  status: 'connecting' | 'live' | 'offline'
  nowMs: number
  subscriptionSymbol: string
  explicitEndTimestamp: number | null
  startTimestamp: number | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveChartStream(event: Event, isActive: boolean): LiveChartStreamState {
  const wsUrl = process.env.WS_LIVE_DATA_URL

  // --- Config ---
  const [config, setConfig] = useState<EventLiveChartConfig | null>(null)

  useEffect(() => {
    const seriesSlug = event.series_slug?.trim()
    if (!seriesSlug) {
      return
    }

    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/live-chart-config?seriesSlug=${encodeURIComponent(seriesSlug!)}`)
        if (!res.ok || cancelled) {
          return
        }
        const data = await res.json()
        if (data && !cancelled) {
          setConfig(data)
        }
      }
      catch {}
    }
    load()
    return () => {
      cancelled = true
    }
  }, [event.series_slug])

  const subscriptionSymbol = useMemo(
    () => config ? normalizeSubscriptionSymbol(config.topic, config.symbol) : '',
    [config],
  )

  // --- Timestamps ---
  const startTimestamp = useMemo(() => parseUtcDate(event.start_date ?? null), [event.start_date])
  const explicitEndTimestamp = useMemo(() => resolveEventEndTimestamp(event), [event])

  // --- Clock ---
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    if (!isActive) {
      return
    }
    setNowMs(Date.now())
    const id = window.setInterval(() => {
      if (!document.hidden) {
        setNowMs(Date.now())
      }
    }, CLOCK_INTERVAL_MS)

    function onVisibility() {
      if (!document.hidden) {
        setNowMs(Date.now())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isActive])

  // --- Price state ---
  const [baselinePrice, setBaselinePrice] = useState<number | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [liveData, setLiveData] = useState<DataPoint[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')

  // --- Baseline fetch ---
  useEffect(() => {
    if (!config) {
      return
    }
    const seriesSlug = config.series_slug?.trim()
    if (!seriesSlug) {
      return
    }

    const snapshotEndMs = explicitEndTimestamp ?? Date.now()
    if (!Number.isFinite(snapshotEndMs) || snapshotEndMs <= 0) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function load() {
      try {
        const query = new URLSearchParams({
          seriesSlug: seriesSlug!,
          eventEndMs: String(snapshotEndMs),
          activeWindowMinutes: String(config!.active_window_minutes),
        })
        if (startTimestamp != null && startTimestamp > 0 && startTimestamp < snapshotEndMs) {
          query.set('eventStartMs', String(startTimestamp))
        }

        const res = await fetch(`/api/price-reference/live-series?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok || cancelled) {
          return
        }

        const payload = await res.json() as LiveSeriesPriceSnapshot
        if (cancelled) {
          return
        }

        if (typeof payload.opening_price === 'number' && Number.isFinite(payload.opening_price) && payload.opening_price > 0) {
          setBaselinePrice(payload.opening_price)
        }

        const fallback = normalizeLiveChartPrice(
          payload.latest_price ?? payload.closing_price ?? Number.NaN,
          config!.topic,
        )
        if (typeof fallback === 'number') {
          setCurrentPrice(fallback)
        }
      }
      catch {}
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [config, explicitEndTimestamp, startTimestamp])

  // --- WebSocket ---
  useEffect(() => {
    if (!isActive || !wsUrl || !config) {
      setStatus('offline')
      return
    }

    let active = true
    let ws: WebSocket | null = null

    function buildPayload(action: 'subscribe' | 'unsubscribe') {
      return JSON.stringify({
        action,
        subscriptions: [{
          topic: config!.topic,
          type: config!.event_type,
          filters: JSON.stringify({ symbol: subscriptionSymbol }),
        }],
      })
    }

    function handleOpen() {
      if (!ws) {
        return
      }
      setStatus('connecting')
      ws.send(buildPayload('subscribe'))
    }

    function handleMessage(msg: MessageEvent<string>) {
      if (!active) {
        return
      }

      let payload: any
      try {
        payload = JSON.parse(msg.data)
      }
      catch {
        return
      }

      const raw = extractLivePriceUpdates(payload, config!.topic, subscriptionSymbol, Date.now())
      const normalized = raw
        .map((u) => {
          const p = normalizeLiveChartPrice(u.price, config!.topic)
          return p != null ? { ...u, price: p } : null
        })
        .filter((u): u is NonNullable<typeof u> => u !== null)

      const isSnapshot = isSnapshotMessage(payload)
      const isBatch = normalized.length > 1
      const updates = USE_ONLY_LAST_UPDATE_PER_MESSAGE
        ? (isSnapshot || isBatch ? normalized : normalized.slice(-1))
        : normalized

      if (!updates.length) {
        return
      }

      setStatus('live')
      const latest = updates.at(-1)
      if (latest) {
        setCurrentPrice(latest.price)
        setBaselinePrice(prev => prev ?? latest.price)
      }

      setLiveData((prev) => {
        const arrivalTimestamp = Date.now()
        const cutoff = arrivalTimestamp - LIVE_DATA_RETENTION_MS

        // Snapshot messages carry historical points with real timestamps.
        // Replace the entire dataset with properly-timestamped points so the
        // chart line spans the full window from the first render — matching
        // the event page's EventLiveSeriesChart snapshot path.
        if (isSnapshot && updates.length > 1) {
          let lastSnapshotTs: number | null = null
          const snapshotPoints: DataPoint[] = []

          for (const update of updates) {
            let ts = update.timestamp
            if (!Number.isFinite(ts)) {
              continue
            }
            ts = Math.max(cutoff + 1, Math.min(ts, arrivalTimestamp))
            if (lastSnapshotTs !== null && ts <= lastSnapshotTs) {
              ts = lastSnapshotTs + 1
            }
            snapshotPoints.push({ date: new Date(ts), [SERIES_KEY]: update.price })
            lastSnapshotTs = ts
          }

          if (snapshotPoints.length > 0) {
            return snapshotPoints.slice(-MAX_POINTS)
          }
        }

        // Incremental updates: append to existing data.
        let next = prev.filter(p => p.date.getTime() >= cutoff)
        let lastTs = next.length ? next.at(-1)!.date.getTime() : null

        for (const update of updates) {
          let ts = Math.max(cutoff + 1, Math.min(update.timestamp, arrivalTimestamp))
          if (lastTs !== null && ts <= lastTs) {
            ts = lastTs + 1
          }
          next = [...next, { date: new Date(ts), [SERIES_KEY]: update.price }]
          lastTs = ts
        }
        return next.slice(-MAX_POINTS)
      })
    }

    function handleError() {
      if (active) {
        setStatus('offline')
      }
    }

    let reconnect: ReturnType<typeof createWebSocketReconnectController> | null = null

    function handleClose() {
      if (!active) {
        return
      }
      setStatus('offline')
      reconnect?.scheduleReconnect()
    }

    function onVisibility() {
      reconnect?.handleVisibilityChange()
    }

    function connect() {
      if (!active || ws || document.hidden) {
        return
      }
      setStatus('connecting')
      ws = new WebSocket(wsUrl!)
      ws.addEventListener('open', handleOpen)
      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)
    }

    reconnect = createWebSocketReconnectController({
      connect,
      getWebSocket: () => ws,
      isActive: () => active,
      resetWebSocket: () => {
        ws = null
      },
    })

    connect()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      setStatus('offline')
      reconnect?.clearReconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(buildPayload('unsubscribe'))
          }
          catch {}
        }
        ws.close()
        ws = null
      }
    }
  }, [isActive, wsUrl, config, subscriptionSymbol])

  return {
    config,
    baselinePrice,
    currentPrice,
    liveData,
    status,
    nowMs,
    subscriptionSymbol,
    explicitEndTimestamp,
    startTimestamp,
  }
}

export { LIVE_WINDOW_MS, MAX_POINTS, SERIES_KEY }
