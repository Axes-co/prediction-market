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
  const elapsedAtPauseRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

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
    startTimeRef.current = null
    elapsedAtPauseRef.current = 0
  }, [totalSlides])

  const tick = useCallback((now: number) => {
    if (pausedRef.current || !enabled) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = now
    }

    const elapsed = now - startTimeRef.current
    const currentProgress = Math.min(elapsed / intervalMs, 1)
    setProgress(currentProgress)

    if (currentProgress >= 1) {
      advanceSlide()
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [advanceSlide, enabled, intervalMs])

  useEffect(() => {
    if (!enabled || totalSlides <= 1) {
      cancelAnimation()
      setProgress(0)
      return
    }

    rafRef.current = requestAnimationFrame(tick)

    return cancelAnimation
  }, [cancelAnimation, enabled, tick, totalSlides])

  const resetTimer = useCallback(() => {
    setProgress(0)
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
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    // Continue from where we paused — offset start time by elapsed amount
    startTimeRef.current = performance.now() - elapsedAtPauseRef.current
  }, [])

  return { activeIndex, progress, goTo, next, prev, pause, resume }
}
