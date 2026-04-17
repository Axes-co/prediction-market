'use client'

import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

function useSentryCapture(error: Error & { digest?: string }) {
  useEffect(function captureExceptionEffect() {
    Sentry.captureException(error)
  }, [error])
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useSentryCapture(error)

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
