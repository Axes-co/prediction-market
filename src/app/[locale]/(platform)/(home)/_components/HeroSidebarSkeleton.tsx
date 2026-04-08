import { Skeleton } from '@/components/ui/skeleton'

export default function HeroSidebarSkeleton() {
  return (
    <div className="flex w-[40%] flex-col gap-4">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 py-2.5">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <div className="shrink-0 space-y-1.5">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-border" />

      <Skeleton className="h-5 w-24" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2.5">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>

      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  )
}
