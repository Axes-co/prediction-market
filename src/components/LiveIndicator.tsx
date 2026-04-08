'use client'

import { useExtracted } from 'next-intl'
import { cn } from '@/lib/utils'

interface LiveIndicatorProps {
  size?: 'default' | 'sm'
}

export default function LiveIndicator({ size = 'default' }: LiveIndicatorProps) {
  const t = useExtracted()
  const isSmall = size === 'sm'

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full',
          isSmall ? 'size-[9px]' : 'size-[11px]',
        )}
      >
        <div className={cn('relative z-10 rounded-full bg-red-500', isSmall ? 'size-[5px]' : 'size-[7px]')} />
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
      </div>
      <span className="text-xs font-semibold tracking-normal text-red-500 uppercase">
        {t('Live')}
      </span>
    </div>
  )
}
