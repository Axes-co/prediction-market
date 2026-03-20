'use client'

import type { ShareCardPayload } from '@/lib/share-card'
import { CopyIcon, Loader2Icon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SocialShareButtons } from '@/components/SocialShareButtons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildPublicProfilePath } from '@/lib/platform-routing'
import { buildShareCardUrl } from '@/lib/share-card'
import { cn } from '@/lib/utils'

interface PositionShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: ShareCardPayload | null
}

export function PositionShareDialog({ open, onOpenChange, payload }: PositionShareDialogProps) {
  const t = useExtracted()
  const isMobile = useIsMobile()
  const site = useSiteIdentity()
  const [shareCardStatus, setShareCardStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shareCardBlob, setShareCardBlob] = useState<Blob | null>(null)
  const [isCopyingShareImage, setIsCopyingShareImage] = useState(false)

  const shareCardUrl = useMemo(() => {
    if (!payload) {
      return ''
    }
    return buildShareCardUrl(payload)
  }, [payload])

  const shareUrl = useMemo(() => {
    if (!payload) {
      return ''
    }
    const profileSlug = payload.userName?.trim() || ''
    if (!profileSlug) {
      return typeof window !== 'undefined' ? window.location.origin : ''
    }
    const profilePath = buildPublicProfilePath(profileSlug) ?? '/'
    return typeof window !== 'undefined'
      ? new URL(profilePath, window.location.origin).toString()
      : profilePath
  }, [payload])

  const buildShareText = useCallback(
    (siteTag: string) => t('Check out this trade on {site}.', { site: siteTag }),
    [t],
  )

  const resetState = useCallback(() => {
    setShareCardStatus('idle')
    setShareCardBlob(null)
    setIsCopyingShareImage(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  useEffect(() => {
    if (!open || !shareCardUrl) {
      return
    }
    setShareCardStatus('loading')
  }, [open, shareCardUrl])

  useEffect(() => {
    if (!shareCardUrl || shareCardStatus !== 'ready') {
      setShareCardBlob(null)
      return
    }

    let isCancelled = false

    fetch(shareCardUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Share card fetch failed.')
        }
        return await response.blob()
      })
      .then((blob) => {
        if (!isCancelled) {
          setShareCardBlob(blob)
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Failed to preload share card image.', error)
          setShareCardBlob(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [shareCardStatus, shareCardUrl])

  const handleShareCardLoaded = useCallback(() => {
    setShareCardStatus('ready')
  }, [])

  const handleShareCardError = useCallback(() => {
    setShareCardStatus('error')
    toast.error(t('Unable to generate a share card right now.'))
  }, [t])

  const handleCopyShareImage = useCallback(async () => {
    if (!shareCardUrl) {
      return
    }

    setIsCopyingShareImage(true)
    try {
      if (!shareCardBlob) {
        toast.info(t('Share card is still preparing. Try again in a moment.'))
        return
      }

      const blob = shareCardBlob.type ? shareCardBlob : new Blob([shareCardBlob], { type: 'image/png' })
      const filename = 'position.png'

      if (typeof window !== 'undefined' && window.isSecureContext && 'ClipboardItem' in window) {
        try {
          const clipboardItem = new ClipboardItem({ [blob.type || 'image/png']: blob })
          await navigator.clipboard.write([clipboardItem])
          toast.success(t('Share card copied to clipboard.'))
          return
        }
        catch (error) {
          console.warn('Clipboard write failed, falling back to download.', error)
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success(t('Share card downloaded.'))
    }
    catch (error) {
      console.error('Failed to copy share card image.', error)
      toast.error(t('Could not copy the share card image.'))
    }
    finally {
      setIsCopyingShareImage(false)
    }
  }, [shareCardBlob, shareCardUrl, t])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }, [onOpenChange, resetState])

  const isShareReady = shareCardStatus === 'ready'
  const shareDialogBody = (
    <div className="space-y-3">
      <div className="relative flex min-h-55 items-center justify-center rounded-lg border bg-muted/30 p-3">
        {shareCardUrl && (
          // eslint-disable-next-line next/no-img-element
          <img
            key={shareCardUrl}
            src={shareCardUrl}
            alt={t('{title} share card', { title: payload?.title ?? t('Position') })}
            className={cn(
              'w-full max-w-md rounded-md shadow-sm transition-opacity',
              isShareReady ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={handleShareCardLoaded}
            onError={handleShareCardError}
          />
        )}
        {!isShareReady && (
          <div className={`
            absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground
          `}
          >
            {shareCardStatus === 'error'
              ? (
                  <span>{t('Unable to generate share card.')}</span>
                )
              : (
                  <>
                    <Loader2Icon className="size-5 animate-spin" />
                    <span>{t('Generating share card...')}</span>
                  </>
                )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleCopyShareImage}
          disabled={!isShareReady || isCopyingShareImage}
        >
          {isCopyingShareImage
            ? <Loader2Icon className="size-4 animate-spin" />
            : <CopyIcon className="size-4" />}
          {isCopyingShareImage ? t('Copying...') : t('Copy image')}
        </Button>
        <SocialShareButtons
          site={site}
          buildShareText={buildShareText}
          shareUrl={shareUrl}
          disabled={!isShareReady || isCopyingShareImage}
          className="flex items-center justify-center gap-2"
        />
      </div>
    </div>
  )

  return isMobile
    ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[90vh] w-full bg-background">
            <DrawerHeader className="p-3 text-center sm:text-center">
              <DrawerTitle className="text-xl font-semibold">{t('Shill your bag')}</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-3 px-4 pb-2">
              {shareDialogBody}
            </div>
          </DrawerContent>
        </Drawer>
      )
    : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-md gap-2 p-4">
            <DialogHeader className="gap-1 text-center sm:text-center">
              <DialogTitle className="text-xl font-semibold">{t('Shill your bag')}</DialogTitle>
            </DialogHeader>
            {shareDialogBody}
          </DialogContent>
        </Dialog>
      )
}
