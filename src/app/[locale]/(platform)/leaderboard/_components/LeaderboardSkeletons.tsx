'use client'

import { Skeleton } from '@/components/ui/skeleton'

interface LeaderboardListSkeletonProps {
  count: number
  rowClassName: string
}

export function LeaderboardListSkeleton({ count, rowClassName }: LeaderboardListSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`leaderboard-skeleton-${index}`} className={rowClassName}>
          <div className="flex min-w-0 items-center gap-5">
            <Skeleton className="h-4 w-3 rounded-full" />
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-44 rounded-full" />
            </div>
          </div>
          <Skeleton className="ml-auto h-4 w-24 rounded-full md:hidden" />
          <Skeleton className="ml-auto hidden h-4 w-24 rounded-full md:block" />
          <Skeleton className="ml-auto hidden h-4 w-28 rounded-full md:block" />
        </div>
      ))}
    </>
  )
}

interface BiggestWinsSkeletonProps {
  count: number
}

export function BiggestWinsSkeleton({ count }: BiggestWinsSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`biggest-wins-skeleton-${index}`}
          className="flex w-full items-center gap-3 border-b border-border/80 py-4 last:border-b-0"
        >
          <Skeleton className="h-3 w-4 rounded-full" />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-32 rounded-full" />
              <Skeleton className="h-3 w-40 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
