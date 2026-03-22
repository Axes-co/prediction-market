'use client'

import type { Event } from '@/types'
import { CodeXmlIcon } from 'lucide-react'
import { useState } from 'react'
import AffiliateWidgetDialog from '@/app/[locale]/(platform)/settings/_components/AffiliateWidgetDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

const headerIconButtonClass = 'size-10 rounded-sm border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:size-9'

interface EventEmbedWidgetProps {
  event: Event
}

export default function EventEmbedWidget({ event }: EventEmbedWidgetProps) {
  const user = useUser()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const affiliateCode = user?.affiliate_code?.trim()

  const market = event.markets.find(m => m.slug)
  if (!affiliateCode || !market) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onMouseDown={(mouseEvent) => {
          mouseEvent.preventDefault()
        }}
        onClick={(clickEvent) => {
          clickEvent.preventDefault()
          clickEvent.stopPropagation()
          setIsDialogOpen(true)
        }}
        title="Embed"
        className={cn(headerIconButtonClass, 'size-auto p-0')}
      >
        <CodeXmlIcon />
      </Button>

      <AffiliateWidgetDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categories={[]}
        eventSlug={event.slug}
      />
    </>
  )
}
