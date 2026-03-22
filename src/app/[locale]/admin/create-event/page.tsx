import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import AdminCreateEventCalendar from '@/app/[locale]/admin/create-event/_components/AdminCreateEventCalendar'

export default async function AdminCreateEventPage({ params }: PageProps<'/[locale]/admin/create-event'>) {
  await connection()
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Suspense
      fallback={(
        <section className="grid gap-4">
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">Event Calendar</h1>
            <p className="text-sm text-muted-foreground">Loading calendar...</p>
          </div>
        </section>
      )}
    >
      <AdminCreateEventCalendar />
    </Suspense>
  )
}
