'use client'

import { cn } from '@/lib/utils'

function FuturesStatusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className={cn(className, 'text-muted-foreground')}
      fill="none"
    >
      <rect
        x="2.75"
        y="2.75"
        width="12.5"
        height="12.5"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="5.75"
        y1="8"
        x2="5.75"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="12.25"
        y1="10.25"
        x2="12.25"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <line
        x1="9"
        y1="5.75"
        x2="9"
        y2="12.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default FuturesStatusIcon
