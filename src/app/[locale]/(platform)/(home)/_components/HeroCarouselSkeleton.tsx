import { Skeleton } from '@/components/ui/skeleton'

export default function HeroCarouselSkeleton() {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="rounded-[18px] border border-border bg-card overflow-hidden min-h-[min(480px,60vh)] max-h-[500px] p-5 pb-4">
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            <div className="w-[40%] space-y-3">
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 h-10">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            className={i === 0 ? 'h-1.5 w-8 rounded-full' : 'size-1.5 rounded-full'}
          />
        ))}
      </div>
    </div>
  )
}
