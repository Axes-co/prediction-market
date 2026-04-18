'use client'

import { cn } from '@/lib/utils'

function UpcomingStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-muted-foreground')}
      fill="none"
    >
      <circle
        cx="9"
        cy="9"
        r="7.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <polyline
        points="9 4.75 9 9 12.25 11.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default UpcomingStatusIcon
