import { ArrowLeftIcon } from 'lucide-react'
import { setRequestLocale } from 'next-intl/server'
import AppLink from '@/components/AppLink'
import { Button } from '@/components/ui/button'

interface AdminCreateEventNewPageProps {
  params: Promise<{
    locale: string
  }>
}

// Polymarket V2 has no public market-creation API. The create-market workflow
// lived on a kuest backend (`CREATE_MARKET_URL`) that does not exist in the
// Polymarket integration. The 7,242-line `AdminCreateEventForm.tsx` and the
// `/api/sync/event-creations` route remain in the repo for rollback, but this
// page renders a placeholder instead of mounting the form.
export default async function AdminCreateEventNewPage({ params }: AdminCreateEventNewPageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold">Create Event</h1>
          <p className="text-sm text-muted-foreground">
            Market creation is not available on the Polymarket integration. New events arrive automatically through Gamma sync.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <AppLink href="/admin/events/calendar">
            <ArrowLeftIcon className="size-4" />
            Back to calendar
          </AppLink>
        </Button>
      </div>

      <div className="rounded-xl border bg-background p-6">
        <p className="text-sm text-muted-foreground">
          Polymarket markets are authored by Polymarket. To make a market visible in the platform, ensure the source is registered in the allowed creators list and wait for the next Gamma sync run.
        </p>
      </div>
    </section>
  )
}
