'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseCarouselAutoAdvanceOptions {
  totalSlides: number
  intervalMs?: number
  enabled?: boolean
}

interface CarouselAutoAdvanceState {
  activeIndex: number
  progress: number
  goTo: (index: number) => void
  next: () => void
  prev: () => void
  pause: () => void
  resume: () => void
}

const DEFAULT_INTERVAL_MS = 10_000

export function useCarouselAutoAdvance({
  totalSlides,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
}: UseCarouselAutoAdvanceOptions): CarouselAutoAdvanceState {
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const pausedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)
  const elapsedAtPauseRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastProgressRef = useRef(0)

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    startTimeRef.current = null
  }, [])

  const advanceSlide = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % totalSlides)
    setProgress(0)
    lastProgressRef.current = 0
    startTimeRef.current = null
    elapsedAtPauseRef.current = 0
  }, [totalSlides])

  const tick = useCallback((now: number) => {
    // When paused, stop the RAF loop entirely instead of spinning idle.
    // The loop restarts when resume() is called.
    if (pausedRef.current || !enabled) {
      rafRef.current = null
      return
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = now
    }

    const elapsed = now - startTimeRef.current
    const currentProgress = Math.min(elapsed / intervalMs, 1)

    // Only trigger re-render when progress changes by >=0.5%
    if (Math.abs(currentProgress - lastProgressRef.current) >= 0.005 || currentProgress >= 1) {
      lastProgressRef.current = currentProgress
      setProgress(currentProgress)
    }

    if (currentProgress >= 1) {
      lastProgressRef.current = 0
      advanceSlide()
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [advanceSlide, enabled, intervalMs])

  const startLoop = useCallback(() => {
    if (rafRef.current !== null) {
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  useEffect(() => {
    if (!enabled || totalSlides <= 1) {
      cancelAnimation()
      setProgress(0)
      return
    }

    startLoop()
    return cancelAnimation
  }, [cancelAnimation, enabled, startLoop, totalSlides])

  // Pause RAF when tab is hidden to save CPU
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        if (!pausedRef.current && startTimeRef.current !== null) {
          elapsedAtPauseRef.current = performance.now() - startTimeRef.current
        }
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
      else if (!pausedRef.current && enabled && totalSlides > 1) {
        startTimeRef.current = performance.now() - elapsedAtPauseRef.current
        startLoop()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, totalSlides, startLoop])

  const resetTimer = useCallback(() => {
    setProgress(0)
    lastProgressRef.current = 0
    startTimeRef.current = null
    elapsedAtPauseRef.current = 0
  }, [])

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalSlides - 1))
    setActiveIndex(clamped)
    resetTimer()
  }, [totalSlides, resetTimer])

  const next = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % totalSlides)
    resetTimer()
  }, [totalSlides, resetTimer])

  const prev = useCallback(() => {
    setActiveIndex(prev => (prev - 1 + totalSlides) % totalSlides)
    resetTimer()
  }, [totalSlides, resetTimer])

  const pause = useCallback(() => {
    if (!pausedRef.current && startTimeRef.current !== null) {
      elapsedAtPauseRef.current = performance.now() - startTimeRef.current
    }
    pausedRef.current = true
    // RAF loop stops naturally on next tick check — no extra cancel needed
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    startTimeRef.current = performance.now() - elapsedAtPauseRef.current
    startLoop()
  }, [startLoop])

  return { activeIndex, progress, goTo, next, prev, pause, resume }
}
