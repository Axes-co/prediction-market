import { useQuery } from '@tanstack/react-query'

interface CommentMetricsResponse {
  comments_count: number
}

export function commentMetricsQueryKey(eventSlug: string) {
  return ['comment-metrics', eventSlug] as const
}

async function fetchCommentMetrics(eventSlug: string, signal?: AbortSignal): Promise<CommentMetricsResponse> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL('/api/comments/metrics', origin)
  url.searchParams.set('event_slug', eventSlug)

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) {
    throw new Error('Failed to load comments count')
  }
  return await response.json() as CommentMetricsResponse
}

/**
 * Reads from our native `/api/comments/metrics`. The endpoint counts rows
 * from our `comments` table — the same source that backs the comment list
 * — so badge counts always match what the user sees in the comments tab.
 */
export function useCommentMetrics(eventSlug: string) {
  return useQuery({
    queryKey: commentMetricsQueryKey(eventSlug),
    queryFn: ({ signal }) => fetchCommentMetrics(eventSlug, signal),
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    retry: 2,
  })
}
