'use client'

import type { Comment } from '@/types'
import { useQuery } from '@tanstack/react-query'

const HERO_COMMENTS_LIMIT = 8

async function fetchRecentComments(eventSlug: string): Promise<Comment[]> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL('/api/comments', origin)
  url.searchParams.set('event_slug', eventSlug)
  url.searchParams.set('limit', HERO_COMMENTS_LIMIT.toString())
  url.searchParams.set('offset', '0')
  url.searchParams.set('sort', 'recent')

  const response = await fetch(url.toString())
  if (!response.ok) {
    return []
  }

  const payload = await response.json()
  return Array.isArray(payload) ? payload : []
}

export function useHeroComments(eventSlug: string) {
  return useQuery({
    queryKey: ['hero-comments', eventSlug],
    queryFn: () => fetchRecentComments(eventSlug),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
