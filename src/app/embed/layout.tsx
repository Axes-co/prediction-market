import type { ReactNode } from 'react'
import { openSauceOne } from '@/lib/fonts'

export const metadata = {
  robots: 'noindex, nofollow',
}

export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={openSauceOne.variable}
        style={{
          margin: 0,
          padding: 0,
          background: 'transparent',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans), system-ui, -apple-system, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  )
}
